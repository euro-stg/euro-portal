import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await db.sdEnvironment.findMany({
      where: { requestId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: rows });
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
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { name, url, username, password, note } = body as {
      name?: string; url?: string; username?: string; password?: string; note?: string;
    };

    if (!name?.trim()) return NextResponse.json({ message: "Nama environment wajib diisi" }, { status: 400 });
    if (!url?.trim())  return NextResponse.json({ message: "URL wajib diisi" }, { status: 400 });

    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });

    if (session.user.id !== req.picId) {
      return NextResponse.json({ message: "Hanya IT PIC yang dapat menambahkan environment" }, { status: 403 });
    }

    const env = await db.sdEnvironment.create({
      data: {
        requestId: id,
        name: name.trim(),
        url: url.trim(),
        username: username?.trim() || null,
        password: password?.trim() || null,
        note: note?.trim() || null,
      },
    });

    await db.sdActivity.create({
      data: { requestId: id, userId: session.user.id, action: "ENV_ADDED", note: `Environment ${name} ditambahkan` },
    });

    return NextResponse.json({ data: env }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id: requestId } = await params;
    const { searchParams } = new URL(request.url);
    const envId = searchParams.get("envId");

    if (!envId) return NextResponse.json({ message: "envId wajib" }, { status: 400 });

    await db.sdEnvironment.delete({ where: { id: envId, requestId } });

    return NextResponse.json({ message: "Environment dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
