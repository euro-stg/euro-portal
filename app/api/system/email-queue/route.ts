import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import {
  BLAST_INTERVAL_KEY, MIN_BLAST_INTERVAL_SECONDS, MAX_BLAST_INTERVAL_SECONDS,
  clampInterval, getBlastIntervalSeconds, invalidateBlastIntervalCache,
} from "@/lib/email-queue";

// Antrean email blast (2026-10-28) — dipakai halaman Pengaturan Email:
//   GET   → ringkasan antrean (menunggu / sedang dikirim / gagal) + jeda saat ini
//   PATCH → { intervalSeconds } ubah jeda antar email blast
//   POST  → { action: "retry-failed" } kirim ulang semua yang gagal
async function guard() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.email]))) return { error: forbidden() };
  return { userId: session.user.id };
}

export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const [groups, intervalSeconds, nextDue] = await Promise.all([
      db.emailQueue.groupBy({ by: ["status"], _count: { _all: true } }),
      getBlastIntervalSeconds(),
      db.emailQueue.findFirst({ where: { status: "queued" }, orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true } }),
    ]);
    const count = (s: string) => groups.find((x) => x.status === s)?._count._all ?? 0;
    const queued = count("queued") + count("sending");

    return NextResponse.json({
      data: {
        queued,
        failed: count("failed"),
        intervalSeconds,
        // Perkiraan kasar: 1 email per jeda, belum termasuk jeda coba ulang.
        estimateMinutes: Math.ceil((queued * intervalSeconds) / 60),
        nextDueAt: nextDue?.scheduledAt ?? null,
        minIntervalSeconds: MIN_BLAST_INTERVAL_SECONDS,
        maxIntervalSeconds: MAX_BLAST_INTERVAL_SECONDS,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const body = await request.json().catch(() => ({}));
    const n = Number((body as { intervalSeconds?: unknown }).intervalSeconds);
    if (!Number.isFinite(n) || n < MIN_BLAST_INTERVAL_SECONDS || n > MAX_BLAST_INTERVAL_SECONDS) {
      return NextResponse.json({ message: `Jeda harus ${MIN_BLAST_INTERVAL_SECONDS}–${MAX_BLAST_INTERVAL_SECONDS} detik` }, { status: 400 });
    }
    const value = String(clampInterval(n));
    await db.systemConfig.upsert({
      where: { key: BLAST_INTERVAL_KEY },
      create: { key: BLAST_INTERVAL_KEY, value, updatedBy: g.userId },
      update: { value, updatedBy: g.userId },
    });
    invalidateBlastIntervalCache();
    return NextResponse.json({ message: `Jeda email blast disimpan: ${value} detik` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const body = await request.json().catch(() => ({}));
    if ((body as { action?: string }).action !== "retry-failed") {
      return NextResponse.json({ message: "Aksi tidak dikenal" }, { status: 400 });
    }
    const { count } = await db.emailQueue.updateMany({
      where: { status: "failed" },
      data: { status: "queued", attempts: 0, lastError: null, lockedAt: null, scheduledAt: new Date() },
    });
    return NextResponse.json({ message: `${count} email dimasukkan kembali ke antrean`, count });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
