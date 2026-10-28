import db from "@/lib/db/db";
import { deliverNotificationEmail, isSmtpConfigured, logEmail, notificationSubject } from "@/lib/mailer";
import { getNotifConfig } from "@/lib/system-config";

// Antrean email blast (2026-10-28). Blast Euro Update & blast E Document memanggil
// enqueueEmails(); worker (startEmailQueueWorker, dijalankan sekali dari instrumentation.ts)
// mengirim SATU email per jeda — jeda diatur di Pengaturan Email (default 10 detik) supaya
// server email tidak menolak/memblokir pengiriman massal. Email realtime (approval,
// notifikasi biasa, lupa password) tidak lewat sini.

export const BLAST_INTERVAL_KEY = "email.blastIntervalSeconds";
export const DEFAULT_BLAST_INTERVAL_SECONDS = 10;
export const MIN_BLAST_INTERVAL_SECONDS = 1;
export const MAX_BLAST_INTERVAL_SECONDS = 3600;

// 1 kali kirim + 3 kali coba ulang, jeda bertambah. Setelah itu status "failed" (bisa
// dikirim ulang manual dari halaman Email Log).
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
// Klaim yang tidak selesai (mis. container mati saat mengirim) diambil ulang setelah ini.
const STALE_LOCK_MS = 5 * 60_000;

export type QueuedEmail = { to: string; title: string; body: string; source: string };

/** Masukkan email ke antrean. Penerima tanpa alamat dibuang. */
export async function enqueueEmails(items: QueuedEmail[]): Promise<number> {
  const rows = items.filter((i) => i.to?.trim());
  if (rows.length === 0) return 0;
  const { count } = await db.emailQueue.createMany({
    data: rows.map((r) => ({ to: r.to.trim(), title: r.title, body: r.body, source: r.source })),
  });
  return count;
}

let intervalCache: { value: number; ts: number } | null = null;

export function clampInterval(n: number): number {
  return Math.min(MAX_BLAST_INTERVAL_SECONDS, Math.max(MIN_BLAST_INTERVAL_SECONDS, Math.round(n)));
}

/** Jeda antar email blast (detik), dari SystemConfig; cache 15 detik. */
export async function getBlastIntervalSeconds(): Promise<number> {
  if (intervalCache && Date.now() - intervalCache.ts < 15_000) return intervalCache.value;
  const row = await db.systemConfig.findUnique({ where: { key: BLAST_INTERVAL_KEY } });
  const n = Number(row?.value);
  const value = Number.isFinite(n) && n > 0 ? clampInterval(n) : DEFAULT_BLAST_INTERVAL_SECONDS;
  intervalCache = { value, ts: Date.now() };
  return value;
}

export function invalidateBlastIntervalCache() {
  intervalCache = null;
}

/**
 * Kirim SATU email dari antrean (yang paling dulu jatuh tempo). Return "sent" | "failed" |
 * "retry" untuk email yang diproses, "idle" kalau tidak ada yang bisa dikirim, atau
 * "paused" kalau pengiriman ditahan (saklar email global mati / SMTP belum diset) — antrean
 * tetap utuh & jatah coba ulang tidak terpakai.
 */
export async function processNextQueuedEmail(): Promise<"sent" | "failed" | "retry" | "idle" | "paused"> {
  const now = new Date();
  // Klaim yang macet dikembalikan ke antrean.
  await db.emailQueue.updateMany({
    where: { status: "sending", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } },
    data: { status: "queued", lockedAt: null },
  });

  const next = await db.emailQueue.findFirst({
    where: { status: "queued", scheduledAt: { lte: now } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!next) return "idle";

  const [config, smtpReady] = await Promise.all([getNotifConfig(), isSmtpConfigured()]);
  if (!config.email || !smtpReady) return "paused";

  // Klaim atomik: hanya satu proses yang berhasil mengubah queued → sending.
  const claimed = await db.emailQueue.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "sending", lockedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return "idle";

  const mail = await db.emailQueue.findUniqueOrThrow({ where: { id: next.id } });
  const result = await deliverNotificationEmail(mail.to, mail.title, mail.body, mail.source);

  if (result.ok) {
    await db.emailQueue.delete({ where: { id: mail.id } });
    await logEmail(mail.to, notificationSubject(mail.title), mail.source, "sent");
    return "sent";
  }

  if (mail.attempts >= MAX_ATTEMPTS) {
    await db.emailQueue.update({ where: { id: mail.id }, data: { status: "failed", lockedAt: null, lastError: result.error } });
    await logEmail(mail.to, notificationSubject(mail.title), mail.source, "failed", `${result.error} (setelah ${mail.attempts}x percobaan)`);
    return "failed";
  }

  const delay = RETRY_DELAYS_MS[mail.attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  await db.emailQueue.update({
    where: { id: mail.id },
    data: { status: "queued", lockedAt: null, lastError: result.error, scheduledAt: new Date(Date.now() + delay) },
  });
  return "retry";
}

const globalForWorker = globalThis as unknown as { __emailQueueWorkerStarted?: boolean };

/**
 * Jalankan worker antrean (sekali per proses server). Tidak jalan di server mode REPLICA
 * (yang memang tidak boleh melakukan operasi tulis/kirim).
 */
export function startEmailQueueWorker() {
  if (globalForWorker.__emailQueueWorkerStarted) return;
  if ((process.env.ENV_MODE ?? "PRODUCTION") === "REPLICA") return;
  globalForWorker.__emailQueueWorkerStarted = true;

  // Jeda dihitung dari AWAL pengiriman sebelumnya ("1 email tiap N detik"), bukan setelah
  // selesai — supaya lamanya SMTP merespons tidak ikut memperlambat. Minimal 1 detik.
  const loop = async () => {
    const startedAt = Date.now();
    let waitSeconds = DEFAULT_BLAST_INTERVAL_SECONDS;
    try {
      waitSeconds = await getBlastIntervalSeconds();
      await processNextQueuedEmail();
    } catch (err) {
      console.error("[email-queue] gagal memproses antrean", err);
    }
    setTimeout(loop, Math.max(1000, waitSeconds * 1000 - (Date.now() - startedAt)));
  };
  setTimeout(loop, 5_000); // beri waktu server siap dulu
  console.log("[email-queue] worker antrean email blast aktif");
}
