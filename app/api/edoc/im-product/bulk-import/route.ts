import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";
import { applyDocumentNumberFixes } from "@/lib/im-bulk-import";
import { createImProducts, validateReviewedRows, type ReviewedRow } from "@/lib/im-import";

export const maxDuration = 120;

// Cocokkan & Import Item (2026-09-25; dengan konfirmasi SKU sejak 2026-11-02) — pelengkap
// fase migrasi: item dari BANYAK file IM sekaligus. Alurnya kini 2 langkah:
//   1. POST /api/edoc/im-product/bulk-import/preview  (Excel → kelompok per IM + cek SKU)
//   2. POST di sini dengan JSON { groups: [{ fileId, rows: [{ product }] }] } (product.sku wajib)
// Langkah 2 menjalankan fase lama (flag requiresItemImport file bulk IM + perbaikan Document
// Number — lihat app/lib/im-bulk-import.ts) lalu MENGGANTI item tiap IM yang dikirim. Semua
// kelompok divalidasi dulu: kalau ada yang salah, tidak ada yang ditulis. Khusus superadmin —
// beroperasi lintas semua file Category IM, tidak terikat folder.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;
    if (!(await isSuperadmin(userId))) {
      return NextResponse.json({ message: "Cocokkan & Import Item hanya untuk superadmin" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { groups?: { fileId?: string; rows?: unknown }[] } | null;
    if (!body || !Array.isArray(body.groups) || body.groups.length === 0) {
      return NextResponse.json({ message: "Tidak ada IM yang dipilih untuk diimport" }, { status: 400 });
    }

    // Validasi SEMUA kelompok dulu (belum ada yang ditulis).
    const fileIds = body.groups.map((g) => g.fileId ?? "");
    if (new Set(fileIds).size !== fileIds.length) return NextResponse.json({ message: "IM yang sama terkirim lebih dari sekali" }, { status: 400 });
    const files = new Map((await db.eDocFile.findMany({
      where: { id: { in: fileIds }, deletedAt: null, category: { code: "IM" } }, select: { id: true, title: true, documentNumber: true },
    })).map((f) => [f.id, f]));
    const valid: { fileId: string; rows: ReviewedRow[] }[] = [];
    for (const g of body.groups) {
      const f = files.get(g.fileId ?? "");
      if (!f) return NextResponse.json({ message: `File IM ${g.fileId} tidak ditemukan` }, { status: 400 });
      const v = await validateReviewedRows(g.rows);
      if ("error" in v) return NextResponse.json({ message: `${f.documentNumber ?? f.title}: ${v.error}` }, { status: 400 });
      valid.push({ fileId: f.id, rows: v.rows });
    }

    const fixes = await applyDocumentNumberFixes();
    const matched: { documentNumber: string; fileId: string; title: string; itemsImported: number }[] = [];
    for (const g of valid) {
      // Replace per IM (re-run aman, tidak menumpuk) — sama seperti import di detail IM.
      const created = await db.$transaction(async (tx) => {
        await tx.eDocImProduct.deleteMany({ where: { fileId: g.fileId } });
        return createImProducts(tx, g.fileId, g.rows, userId);
      });
      const f = await db.eDocFile.findUnique({ where: { id: g.fileId }, select: { title: true, documentNumber: true } });
      matched.push({ documentNumber: f?.documentNumber ?? "-", fileId: g.fileId, title: f?.title ?? "-", itemsImported: created.length });
    }
    return NextResponse.json({ ...fixes, matched }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
