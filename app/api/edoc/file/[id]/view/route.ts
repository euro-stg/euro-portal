import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canViewFile, downloadEDocFile } from "@/lib/edoc";
import { EDOC_VIEWER_HEADER } from "@/lib/edoc-viewer";

// Sumber PDF untuk viewer internal (2026-10-07) — terpisah dari /download supaya file yang
// allowDownload=false tetap bisa DILIHAT tanpa bisa di-download. Sengaja cuma melayani
// request yang membawa header EDOC_VIEWER_HEADER (dikirim fetch() dari viewer): URL ini
// yang di-paste/dibuka langsung di address bar tidak bisa menambah header custom, jadi
// ditolak — bukan pengaman mutlak (isi PDF tetap sampai ke browser), cuma menutup jalan
// pintas "buka URL-nya langsung lalu Save As" yang paling gampang.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    if (request.headers.get(EDOC_VIEWER_HEADER) !== "1") {
      return NextResponse.json({ message: "Buka file ini lewat viewer E Document" }, { status: 403 });
    }

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, select: { id: true, fileUrl: true, folderId: true, status: true, uploadedBy: true } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (!(await canViewFile(userId, file))) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const nextcloudRes = await downloadEDocFile(file.fileUrl).catch(() => null);
    if (!nextcloudRes || !nextcloudRes.ok) {
      return NextResponse.json({ message: "File tidak ditemukan di storage" }, { status: 404 });
    }

    const buffer = await nextcloudRes.arrayBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
