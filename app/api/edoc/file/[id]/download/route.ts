import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canViewFile, downloadEDocFile } from "@/lib/edoc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, select: { id: true, fileUrl: true, title: true, folderId: true, status: true, uploadedBy: true } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    // Sebelumnya cuma cek ACL folder biasa — Document Approver yang tidak punya akses ACL
    // ke folder file itu jadi bisa lihat detailnya (lolos lewat canViewDraftFile) tapi GAGAL
    // buka PDF-nya (404 di sini). Dibenerin 2026-09-21 pakai canViewFile yang konsisten
    // dengan gerbang di GET /api/edoc/file/[id].
    if (!(await canViewFile(userId, file))) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const nextcloudRes = await downloadEDocFile(file.fileUrl).catch(() => null);
    if (!nextcloudRes || !nextcloudRes.ok) {
      return NextResponse.json({ message: "File tidak ditemukan di storage" }, { status: 404 });
    }

    const buffer = await nextcloudRes.arrayBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file.title.replace(/[^a-zA-Z0-9._ -]/g, "-")}.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
