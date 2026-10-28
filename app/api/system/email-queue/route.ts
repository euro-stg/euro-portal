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
//   GET   → ringkasan antrean + daftar kelompok blast (satu baris per batchId)
//   GET   ?batchId=…&status=&q=&page= → detail penerima satu blast
//   PATCH → { intervalSeconds } ubah jeda antar email blast
//   POST  → { action: "retry-failed", batchId? } kirim ulang yang gagal (semua / satu blast)
//           { action: "cancel-batch", batchId }  batalkan sisa satu blast (yang belum terkirim)
const DETAIL_PAGE_SIZE = 25;
const STATUSES = ["queued", "sending", "failed"];
async function guard() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.email]))) return { error: forbidden() };
  return { userId: session.user.id };
}

export async function GET(request: Request) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const sp = new URL(request.url).searchParams;
    const batchId = sp.get("batchId");
    if (batchId) {
      const status = sp.get("status") ?? "";
      const q = sp.get("q")?.trim() ?? "";
      const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
      const where = {
        batchId,
        ...(STATUSES.includes(status) ? { status } : {}),
        ...(q ? { to: { contains: q, mode: "insensitive" as const } } : {}),
      };
      const [total, rows] = await Promise.all([
        db.emailQueue.count({ where }),
        db.emailQueue.findMany({
          where,
          orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
          skip: (page - 1) * DETAIL_PAGE_SIZE,
          take: DETAIL_PAGE_SIZE,
          select: { id: true, to: true, status: true, attempts: true, scheduledAt: true, lastError: true },
        }),
      ]);
      return NextResponse.json({ data: rows, total, page, totalPages: Math.max(1, Math.ceil(total / DETAIL_PAGE_SIZE)) });
    }

    const [groups, batchGroups, intervalSeconds, nextDue] = await Promise.all([
      db.emailQueue.groupBy({ by: ["status"], _count: { _all: true } }),
      db.emailQueue.groupBy({
        by: ["batchId", "title", "source", "status"],
        _count: { _all: true }, _min: { createdAt: true },
      }),
      getBlastIntervalSeconds(),
      db.emailQueue.findFirst({ where: { status: "queued" }, orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true } }),
    ]);
    const count = (s: string) => groups.find((x) => x.status === s)?._count._all ?? 0;
    const queued = count("queued") + count("sending");

    // Satu baris per blast. Judul diambil dari email pertama yang ditemukan (sama untuk satu batch).
    type Batch = { batchId: string; title: string; source: string; queued: number; failed: number; createdAt: Date };
    const byBatch = new Map<string, Batch>();
    for (const b of batchGroups) {
      const cur = byBatch.get(b.batchId) ?? { batchId: b.batchId, title: b.title, source: b.source, queued: 0, failed: 0, createdAt: b._min.createdAt! };
      if (b.status === "failed") cur.failed += b._count._all; else cur.queued += b._count._all;
      if (b._min.createdAt && b._min.createdAt < cur.createdAt) cur.createdAt = b._min.createdAt;
      byBatch.set(b.batchId, cur);
    }
    const batches = [...byBatch.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      data: {
        queued,
        failed: count("failed"),
        intervalSeconds,
        // Perkiraan kasar: 1 email per jeda, belum termasuk jeda coba ulang.
        estimateMinutes: Math.ceil((queued * intervalSeconds) / 60),
        nextDueAt: nextDue?.scheduledAt ?? null,
        batches,
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

    const body = (await request.json().catch(() => ({}))) as { action?: string; batchId?: string };
    const batchId = typeof body.batchId === "string" && body.batchId ? body.batchId : null;

    if (body.action === "retry-failed") {
      const { count } = await db.emailQueue.updateMany({
        where: { status: "failed", ...(batchId ? { batchId } : {}) },
        data: { status: "queued", attempts: 0, lastError: null, lockedAt: null, scheduledAt: new Date() },
      });
      return NextResponse.json({ message: `${count} email dimasukkan kembali ke antrean`, count });
    }

    if (body.action === "cancel-batch") {
      if (!batchId) return NextResponse.json({ message: "batchId wajib diisi" }, { status: 400 });
      // Yang sedang dikirim (status "sending") dibiarkan selesai — hanya sisa yang dibatalkan.
      const { count } = await db.emailQueue.deleteMany({ where: { batchId, status: { in: ["queued", "failed"] } } });
      return NextResponse.json({ message: `${count} email dibatalkan`, count });
    }

    return NextResponse.json({ message: "Aksi tidak dikenal" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
