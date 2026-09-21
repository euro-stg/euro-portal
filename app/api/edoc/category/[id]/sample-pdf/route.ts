import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, uploadEDocCategorySamplePdf, deleteEDocCategorySamplePdf, fetchEDocCategorySamplePdf } from "@/lib/edoc";

// Contoh PDF per Category dipakai sebagai dasar preview posisi stempel (Document
// Number/MOC Number/Watermark) di halaman Pengaturan — disimpan persisten di Nextcloud
// (bukan cuma di state form) supaya tetap kelihatan tanpa perlu upload ulang tiap kali.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const category = await db.eDocCategory.findFirst({ where: { id, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });
    if (!category.samplePdfPath) return NextResponse.json({ message: "Belum ada contoh PDF" }, { status: 404 });

    const res = await fetchEDocCategorySamplePdf(category.samplePdfPath);
    if (!res.ok) return NextResponse.json({ message: "Gagal mengambil contoh PDF dari Nextcloud" }, { status: 502 });
    const buffer = await res.arrayBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=sample.pdf" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const category = await db.eDocCategory.findFirst({ where: { id, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ message: "Contoh file harus PDF" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const path = await uploadEDocCategorySamplePdf(id, buffer);
    return NextResponse.json({ data: { samplePdfPath: path } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const category = await db.eDocCategory.findFirst({ where: { id, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    await deleteEDocCategorySamplePdf(id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
