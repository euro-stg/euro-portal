import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { uploadToNextcloud } from "@/lib/nextcloud";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id: letterId } = await params;
    const letter = await db.ssdLetter.findUnique({ where: { id: letterId, deletedAt: null } });
    if (!letter) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    if (letter.status !== "APPROVED")
      return NextResponse.json({ message: "Hanya surat APPROVED yang bisa upload file final" }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 400 });

    const ext = file.name.split(".").pop() ?? "bin";
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `final-${letterId}-${ts}.${ext}`;

    const buffer = await file.arrayBuffer();
    const path = await uploadToNextcloud(buffer, filename);

    await db.$transaction(async (tx) => {
      await tx.ssdLetter.update({
        where: { id: letterId },
        data: { fileFinal: path, status: "DONE", updatedAt: new Date() },
      });
      await tx.ssdActivity.create({
        data: { letterId, userId, action: "DONE", note: "File final diupload, surat selesai" },
      });
    });

    return NextResponse.json({ message: "File final berhasil diupload", path });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
