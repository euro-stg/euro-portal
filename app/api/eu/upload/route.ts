import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { uploadToNextcloud } from "@/lib/nextcloud";

export const maxDuration = 60;

const ALLOWED = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx"];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 400 });

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED.includes(ext))
      return NextResponse.json({ message: `Tipe file tidak didukung. Gunakan: ${ALLOWED.join(", ")}` }, { status: 400 });

    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ message: "Ukuran file maksimal 10MB" }, { status: 400 });

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `eu-${ts}.${ext}`;

    const buffer = await file.arrayBuffer();
    const path = await uploadToNextcloud(buffer, filename);

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    return NextResponse.json({ path, filename, originalName: safe, mimeType: file.type });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err instanceof Error ? err.message : "Upload gagal" }, { status: 500 });
  }
}
