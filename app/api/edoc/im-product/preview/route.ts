import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canEditFileMetadata, parseImProductImport } from "@/lib/edoc";
import { buildImportPreview } from "@/lib/im-import";

// Pratinjau import item IM (2026-10-30; validasi berbasis SKU sejak 2026-11-02) — baca Excel &
// cek SKU tiap baris ke Master Item, TANPA menyimpan apa pun. Multipart:
//   file    Excel item IM (wajib; kolom SKU wajib)
//   fileId  IM yang sudah ada (import di detail IM) — untuk cek izin & No. IM. Kosong = upload IM baru.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const formData = await request.formData();
    const excel = formData.get("file") as File | null;
    const fileId = (formData.get("fileId") as string | null) || null;
    if (!excel) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });

    let expectedDocumentNumber: string | null = null;
    if (fileId) {
      const edocFile = await db.eDocFile.findFirst({ where: { id: fileId, deletedAt: null }, include: { category: { select: { code: true } } } });
      if (!edocFile) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
      if (edocFile.category.code !== "IM") return NextResponse.json({ message: "Lampiran item hanya berlaku untuk file Category IM" }, { status: 400 });
      if (!(await canEditFileMetadata(userId, edocFile))) return NextResponse.json({ message: "Anda tidak memiliki izin untuk import item ke file ini" }, { status: 403 });
      expectedDocumentNumber = edocFile.documentNumber;
    }

    let parsed;
    try {
      parsed = parseImProductImport(await excel.arrayBuffer(), expectedDocumentNumber);
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
    }
    if ((await db.masterItem.count()) === 0) {
      return NextResponse.json({ message: "Master Item masih kosong — jalankan Sync ERP di Data Master → Master Item dulu" }, { status: 409 });
    }
    const preview = await buildImportPreview(parsed.products);
    return NextResponse.json({ ...preview, warnings: parsed.warnings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
