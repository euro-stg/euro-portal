import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createNotification } from "@/lib/notifications";

const ALLOWED_MIME = [
  "application/pdf",
  "image/png", "image/jpeg", "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;
    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (req.status !== "UAT") return NextResponse.json({ message: "Hanya bisa revisi dari status UAT" }, { status: 400 });
    if (req.requestedBy !== userId) return NextResponse.json({ message: "Hanya pengaju yang dapat meminta revisi" }, { status: 403 });

    const formData = await request.formData();
    const note = (formData.get("note") as string | null)?.trim() || null;
    const files = formData.getAll("files") as File[];

    // Hitung iterasi berikutnya
    const count = await db.sdUatRevision.count({ where: { requestId: id } });
    const iteration = count + 1;

    // Buat revision record + ubah status dalam transaksi
    const revision = await db.$transaction(async (tx) => {
      const rev = await tx.sdUatRevision.create({
        data: { requestId: id, iteration, note, createdBy: userId },
      });

      await tx.sdRequest.update({
        where: { id },
        data: { status: "UAT_REVISION", updatedAt: new Date() },
      });

      await tx.sdActivity.create({
        data: {
          requestId: id,
          userId,
          action: "UAT_REVISION",
          note: note ?? `Revisi ke-${iteration}`,
        },
      });

      return rev;
    });

    // Upload files jika ada
    const uploaded: string[] = [];
    for (const file of files) {
      if (!file || !file.name) continue;
      if (!ALLOWED_MIME.includes(file.type)) continue;
      if (file.size > 10 * 1024 * 1024) continue;

      const ts = Date.now();
      const fname = `${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const dir = path.join(process.cwd(), "uploads", "sd", id);
      const fpath = path.join(dir, fname);
      const publicPath = `/api/files/sd/${id}/${fname}`;

      await mkdir(dir, { recursive: true });
      await writeFile(fpath, Buffer.from(await file.arrayBuffer()));

      await db.sdAttachment.create({
        data: {
          requestId: id,
          uatRevisionId: revision.id,
          category: "UAT_REVISION",
          name: file.name,
          path: publicPath,
          mimeType: file.type,
          size: file.size,
          uploadedBy: userId,
        },
      });

      uploaded.push(file.name);
    }

    // Notify PIC: ada permintaan revisi
    if (req.picId && req.picId !== userId) {
      await createNotification(req.picId, `Permintaan Revisi UAT ke-${iteration}`,
        `"${req.title}": ${note ?? "Pengaju meminta revisi"}`,
        "APPROVAL_REQUEST", id, "SD");
    }

    return NextResponse.json({ data: { revision, uploaded } }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
