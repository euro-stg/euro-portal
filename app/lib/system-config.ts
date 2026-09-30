import db from "@/lib/db/db";

type NotifConfig = { inapp: boolean; email: boolean };

let cache: { data: NotifConfig; ts: number } | null = null;
const TTL = 60_000; // 60 detik

export async function getNotifConfig(): Promise<NotifConfig> {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;

  const rows = await db.systemConfig.findMany({
    where: { key: { in: ["notifications.inapp", "notifications.email"] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const data: NotifConfig = {
    inapp: map["notifications.inapp"] !== "false",
    email: map["notifications.email"] !== "false",
  };

  cache = { data, ts: Date.now() };
  return data;
}

export function invalidateNotifCache() {
  cache = null;
}

// Toggle "Blast Email" E Document (2026-09-30) — proteksi testing, admin bisa matikan
// sementara supaya percobaan approve tidak nyasar email ke user asli. Dicek hanya saat
// approval (jarang), jadi tidak perlu cache seperti getNotifConfig di atas.
const EDOC_BLAST_EMAIL_KEY = "edoc.blastEmail.enabled";

export async function getEdocBlastEmailEnabled(): Promise<boolean> {
  const row = await db.systemConfig.findUnique({ where: { key: EDOC_BLAST_EMAIL_KEY } });
  return row?.value !== "false";
}

export async function setEdocBlastEmailEnabled(enabled: boolean, updatedBy: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: EDOC_BLAST_EMAIL_KEY },
    create: { key: EDOC_BLAST_EMAIL_KEY, value: String(enabled), updatedBy },
    update: { value: String(enabled), updatedBy },
  });
}
