import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canEditFileMetadata } from "@/lib/edoc";
import { createImProducts, validateReviewedRows } from "@/lib/im-import";

// Simpan item IM hasil review mapping SKU (2026-10-30) — JSON { fileId, rows: [{ product,
// skus: [{ company, itemCode }] }] } dari layar review (lihat /api/edoc/im-product/preview).
// Excel tidak lagi disimpan langsung: setiap baris WAJIB punya SKU (import diblokir kalau
// belum). Hardcoded khusus Category IM. Akses = canEditFileMetadata (superadmin, Document
// Approver, uploader selagi requiresNumber=false, Folder Creator/penulis folder untuk file
// Bulk Import) — sama dengan edit metadata.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const body = (await request.json().catch(() => ({}))) as { fileId?: string; rows?: unknown };
    if (!body.fileId) return NextResponse.json({ message: "fileId wajib diisi" }, { status: 400 });
    const fileId = body.fileId;

    const edocFile = await db.eDocFile.findFirst({ where: { id: fileId, deletedAt: null }, include: { category: { select: { code: true } } } });
    if (!edocFile) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (edocFile.category.code !== "IM") return NextResponse.json({ message: "Lampiran produk/SKU hanya berlaku untuk file Category IM" }, { status: 400 });
    if (!(await canEditFileMetadata(userId, edocFile))) {
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk import data produk ke file ini" }, { status: 403 });
    }

    const v = await validateReviewedRows(body.rows);
    if ("error" in v) return NextResponse.json({ message: v.error }, { status: 400 });

    // Replace total dalam 1 transaksi (sejak 2026-09-25): import ulang = ganti semua item lama.
    const created = await db.$transaction(async (tx) => {
      await tx.eDocImProduct.deleteMany({ where: { fileId } });
      return createImProducts(tx, fileId, v.rows, userId);
    });
    return NextResponse.json({ data: created, imported: created.length }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
