import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { uploadToNextcloud } from "@/lib/nextcloud";
import { SSD_ALLOWED_EXT, SSD_MAX_FILE_BYTES, ssdDraftFilename } from "@/lib/ssd";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    // Unggah draft hanya untuk Org Admin (satu-satunya yang boleh membuat/mengedit surat).
    if (!(await db.ssdOrgAdmin.findUnique({ where: { userId }, select: { id: true } })))
      return NextResponse.json({ message: "Hanya Org Admin SSD yang dapat mengunggah file" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ message: "File kosong" }, { status: 400 });
    if (file.size > SSD_MAX_FILE_BYTES) return NextResponse.json({ message: "File maksimal 10MB" }, { status: 413 });

    const ALLOWED = SSD_ALLOWED_EXT;
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED.includes(ext))
      return NextResponse.json({ message: `Tipe file tidak didukung. Gunakan: ${ALLOWED.join(", ")}` }, { status: 400 });

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    // Nama dibuat server (awalan dari klien diabaikan) & memuat id pengunggah → kepemilikan bisa dicek.
    const filename = ssdDraftFilename(userId, ext);

    const buffer = await file.arrayBuffer();
    const path = await uploadToNextcloud(buffer, filename);

    return NextResponse.json({ path, filename, originalName: safe });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
