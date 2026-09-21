import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, stampEDocPdf, createBlankA4PdfWithRuler, fetchEDocCategorySamplePdf, type EDocStamp } from "@/lib/edoc";

// Preview stempel (Document Number / MOC Number / Watermark) di atas dasar PDF, dengan
// prioritas: file yang baru diupload di request ini > contoh PDF tersimpan milik Category
// (categoryId) > halaman A4 kosong berpenanda mm sebagai default terakhir. Dipakai halaman
// Pengaturan supaya admin bisa lihat posisi X/Y beneran sebelum commit.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryId = formData.get("categoryId") as string | null;
    const stampsRaw = formData.get("stamps") as string | null;

    let stamps: EDocStamp[] = [];
    try {
      stamps = stampsRaw ? JSON.parse(stampsRaw) : [];
    } catch {
      return NextResponse.json({ message: "Format stamps tidak valid" }, { status: 400 });
    }
    if (!Array.isArray(stamps) || stamps.length === 0) {
      return NextResponse.json({ message: "Minimal 1 stempel untuk di-preview" }, { status: 400 });
    }
    for (const s of stamps) {
      if (typeof s.positionXMm !== "number" || typeof s.positionYMm !== "number") {
        return NextResponse.json({ message: "Posisi X/Y wajib diisi untuk preview" }, { status: 400 });
      }
    }

    let baseBuffer: ArrayBuffer | null = null;
    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ message: "Contoh file harus PDF" }, { status: 400 });
      }
      baseBuffer = await file.arrayBuffer();
    } else if (categoryId) {
      const category = await db.eDocCategory.findFirst({ where: { id: categoryId, deletedAt: null }, select: { samplePdfPath: true } });
      if (category?.samplePdfPath) {
        const res = await fetchEDocCategorySamplePdf(category.samplePdfPath);
        if (res.ok) baseBuffer = await res.arrayBuffer();
      }
    }
    if (!baseBuffer) {
      const blank = await createBlankA4PdfWithRuler();
      baseBuffer = blank.buffer.slice(blank.byteOffset, blank.byteOffset + blank.byteLength) as ArrayBuffer;
    }

    let stamped: Uint8Array;
    try {
      stamped = await stampEDocPdf(baseBuffer, stamps);
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca PDF" }, { status: 400 });
    }

    return new NextResponse(new Uint8Array(stamped), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview.pdf",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
