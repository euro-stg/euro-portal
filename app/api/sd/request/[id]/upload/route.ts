import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });

    const userId = session.user.id;
    const isRequester = userId === req.requestedBy;
    const isPic       = !!(req.picId && userId === req.picId);

    // Cek portal role superadmin
    const portalRoleRow = await db.userRole.findFirst({
      where: { userId, role: { appId: null, name: "superadmin", status: "active", deletedAt: null } },
    });
    const isSuperadmin = !!portalRoleRow;

    const formData = await request.formData();
    const file     = formData.get("file") as File | null;
    const itDocId  = formData.get("itDocId") as string | null;
    const category = (formData.get("category") as string | null) ?? "REQUEST";

    const VALID_CATEGORIES = ["REQUEST", "IT_DOC", "PROGRESS", "UAT"];
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ message: "Category tidak valid" }, { status: 400 });
    }

    // Validasi permission per kategori
    const allowed =
      isSuperadmin ||
      (category === "REQUEST" && isRequester) ||
      (category === "IT_DOC"  && (isPic || isRequester)) ||
      (category === "PROGRESS" && isPic) ||
      (category === "UAT"     && (isRequester || isPic));

    if (!allowed) {
      return NextResponse.json({ message: "Tidak memiliki izin untuk mengunggah lampiran ini" }, { status: 403 });
    }
    if (!file) return NextResponse.json({ message: "File wajib diunggah" }, { status: 400 });

    const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                     "application/msword"];
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ message: "Hanya file PDF, Word, atau gambar yang diizinkan" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "Ukuran file maksimal 10MB" }, { status: 400 });
    }

    const ts     = Date.now();
    const fname  = `${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const dir    = path.join(process.cwd(), "public", "uploads", "sd", id);
    const fpath  = path.join(dir, fname);
    const publicPath = `/uploads/sd/${id}/${fname}`;

    await mkdir(dir, { recursive: true });
    await writeFile(fpath, Buffer.from(await file.arrayBuffer()));

    const attachment = await db.sdAttachment.create({
      data: {
        requestId: itDocId ? null : id,
        itDocId: itDocId || null,
        category,
        name: file.name,
        path: publicPath,
        mimeType: file.type,
        size: file.size,
        uploadedBy: session.user.id,
      },
    });

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
