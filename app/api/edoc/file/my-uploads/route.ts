import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

const PAGE_SIZE = 20;
const STATUSES = ["RELEASE", "DRAFT", "REJECTED"] as const;

// History Upload (2026-10-20) — file E Document yang DI-UPLOAD oleh user yang login saja
// (uploadedBy = saya; file di mana saya cuma Inisiator tapi di-upload orang lain tidak ikut).
// Karena selalu dibatasi ke file milik sendiri, cukup login — tidak perlu cek role.
// Filter:
//   status      → ALL | RELEASE | DRAFT | REJECTED (DRAFT = menunggu approval)
//   from / to   → rentang tanggal upload (createdAt), format YYYY-MM-DD, zona WIB
//   q           → cari judul / nomor dokumen
// Ringkasan (kartu) mengikuti filter tanggal & cari, tapi TIDAK ikut filter status —
// supaya kartu tetap menunjukkan perbandingan antar-status.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") ?? "ALL";
    const status = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : null;
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const parseDay = (v: string | null, endOfDay: boolean) => {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
      return new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
    };
    const from = parseDay(searchParams.get("from"), false);
    const to = parseDay(searchParams.get("to"), true);

    const baseWhere = {
      deletedAt: null,
      uploadedBy: userId,
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { documentNumber: { contains: q, mode: "insensitive" as const } }] } : {}),
    };
    const where = { ...baseWhere, ...(status && { status }) };

    const [groups, total, rows] = await Promise.all([
      db.eDocFile.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
      db.eDocFile.count({ where }),
      db.eDocFile.findMany({
        where,
        select: {
          id: true, title: true, documentNumber: true, status: true, organizationId: true, bulkImported: true,
          createdAt: true, approvedAt: true, approvalNote: true, rejectedAt: true, rejectionNote: true,
          category: { select: { code: true, name: true } },
          categoryType: { select: { name: true } },
          folder: { select: { name: true } },
          approver: { select: { name: true } },
          rejecter: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    const countOf = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
    const summary = {
      total: groups.reduce((n, g) => n + g._count._all, 0),
      release: countOf("RELEASE"),
      pending: countOf("DRAFT"),
      rejected: countOf("REJECTED"),
    };

    const orgIds = [...new Set(rows.map((f) => f.organizationId).filter((v): v is string => !!v))];
    const orgs = orgIds.length ? await db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, code: true } }) : [];
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    return NextResponse.json({
      summary,
      data: rows.map((f) => ({ ...f, organization: f.organizationId ? orgById.get(f.organizationId) ?? null : null })),
      total, page, pageSize: PAGE_SIZE,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
