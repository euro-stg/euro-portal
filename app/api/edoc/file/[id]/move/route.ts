import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, moveEDocFile } from "@/lib/edoc";

// "Move File" — untuk kasus salah upload ke folder yang salah. Akses: uploader file ini
// atau superadmin (2026-09-30, dikonfirmasi user) — TIDAK dibatasi status DRAFT-only, sama
// filosofinya seperti Blast: pindah folder murni soal lokasi, tidak menyentuh isi/nomor/
// status resmi file, jadi aman diatur kapan saja oleh uploader/superadmin. Folder tujuan
// bebas folder manapun (tidak dicek akses write ke folder tujuan) selama bukan Obsolete —
// sama persis aturan Blast folder.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, select: { folderId: true, uploadedBy: true } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    if (!superadmin && file.uploadedBy !== userId) {
      return NextResponse.json({ message: "Hanya pembuat file atau superadmin yang bisa memindahkan file ini" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const folderId = typeof (body as { folderId?: unknown })?.folderId === "string" ? (body as { folderId: string }).folderId : null;
    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });

    const dest = await db.eDocFolder.findFirst({ where: { id: folderId, deletedAt: null }, select: { type: true } });
    if (!dest) return NextResponse.json({ message: "Folder tujuan tidak ditemukan" }, { status: 404 });
    if (dest.type === "OBSOLETE") return NextResponse.json({ message: "Tidak bisa pindah ke folder Obsolete" }, { status: 400 });

    try {
      await moveEDocFile(id, folderId);
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal memindahkan file" }, { status: 502 });
    }

    return NextResponse.json({ message: "File berhasil dipindahkan", folderId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
