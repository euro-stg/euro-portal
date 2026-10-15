import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, isEDocDocumentApprover } from "@/lib/edoc";

const PAGE_SIZE = 20;

// Report Approver (2026-10-15) — ringkasan + riwayat dokumen yang SUDAH di-approve atau
// di-reject oleh Document Approver mana pun (bukan cuma diri sendiri), dengan filter:
//   mine=true          → hanya yang di-approve/reject oleh user ini
//   from / to          → rentang tanggal aksi (approvedAt / rejectedAt), format YYYY-MM-DD
//   status             → ALL | RELEASE | REJECTED
//   q                  → cari judul / nomor dokumen
// Kartu "Menunggu" = antrean approval saat ini (global, tidak ikut filter) — sama dengan
// isi menu Approval Document. Akses: Document Approver & superadmin saja.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, approver] = await Promise.all([isSuperadmin(userId), isEDocDocumentApprover(userId)]);
    if (!superadmin && !approver) return forbidden("Report Approver hanya untuk Document Approver");

    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "true";
    const status = searchParams.get("status") ?? "ALL";
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const parseDay = (v: string | null, endOfDay: boolean) => {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
      return new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
    };
    const from = parseDay(searchParams.get("from"), false);
    const to = parseDay(searchParams.get("to"), true);
    const range = from || to ? { ...(from && { gte: from }), ...(to && { lte: to }) } : { not: null };

    const search = q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { documentNumber: { contains: q, mode: "insensitive" as const } }] } : {};
    const approvedWhere = {
      deletedAt: null, requiresNumber: true, status: "RELEASE", approvedAt: range,
      ...(mine && { approvedBy: userId }), ...search,
    };
    const rejectedWhere = {
      deletedAt: null, status: "REJECTED", rejectedAt: range,
      ...(mine && { rejectedBy: userId }), ...search,
    };

    const select = {
      id: true, title: true, documentNumber: true, status: true, organizationId: true,
      approvedAt: true, approvalNote: true, rejectedAt: true, rejectionNote: true, createdAt: true,
      category: { select: { code: true, name: true } },
      categoryType: { select: { name: true } },
      folder: { select: { name: true } },
      uploader: { select: { name: true, employeeId: true } },
      approver: { select: { name: true } },
      rejecter: { select: { name: true } },
    };
    const wantApproved = status !== "REJECTED";
    const wantRejected = status !== "RELEASE";
    // Ambil cukup baris dari masing-masing sumber untuk halaman ini, gabung, urutkan per
    // tanggal aksi, lalu potong — benar untuk paginasi tanpa perlu ORDER BY COALESCE.
    const take = page * PAGE_SIZE;
    const [approvedCount, rejectedCount, pendingCount, approvedRows, rejectedRows] = await Promise.all([
      db.eDocFile.count({ where: approvedWhere }),
      db.eDocFile.count({ where: rejectedWhere }),
      db.eDocFile.count({ where: { deletedAt: null, requiresNumber: true, status: "DRAFT" } }),
      wantApproved ? db.eDocFile.findMany({ where: approvedWhere, select, orderBy: { approvedAt: "desc" }, take }) : [],
      wantRejected ? db.eDocFile.findMany({ where: rejectedWhere, select, orderBy: { rejectedAt: "desc" }, take }) : [],
    ]);

    const merged = [...approvedRows, ...rejectedRows]
      .map((f) => ({ ...f, actedAt: (f.status === "REJECTED" ? f.rejectedAt : f.approvedAt) as Date }))
      .sort((a, b) => b.actedAt.getTime() - a.actedAt.getTime())
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const orgIds = [...new Set(merged.map((f) => f.organizationId).filter((v): v is string => !!v))];
    const orgs = orgIds.length ? await db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, code: true } }) : [];
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const total = (wantApproved ? approvedCount : 0) + (wantRejected ? rejectedCount : 0);
    return NextResponse.json({
      summary: { approved: approvedCount, rejected: rejectedCount, pending: pendingCount },
      data: merged.map((f) => ({ ...f, organization: f.organizationId ? orgById.get(f.organizationId) ?? null : null })),
      total, page, pageSize: PAGE_SIZE,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
