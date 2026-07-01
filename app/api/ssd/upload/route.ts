import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToNextcloud } from "@/lib/nextcloud";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string | null) ?? "ssd";

    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 400 });

    const ALLOWED = ["pdf","doc","docx","jpg","jpeg","png","gif","webp"];
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED.includes(ext))
      return NextResponse.json({ message: `Tipe file tidak didukung. Gunakan: ${ALLOWED.join(", ")}` }, { status: 400 });

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${prefix}-${ts}.${ext}`;

    const buffer = await file.arrayBuffer();
    const path = await uploadToNextcloud(buffer, filename);

    return NextResponse.json({ path, filename, originalName: safe });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
