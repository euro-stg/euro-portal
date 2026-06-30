import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const letter = await db.ssdLetter.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: true,
        department: true,
        company: true,
        requester: { select: { id: true, name: true, jobPositionName: true, organizationName: true, branchName: true } },
        approval: {
          include: {
            steps: { orderBy: { step: "asc" }, include: { actor: { select: { id: true, name: true } } } },
            template: { select: { id: true, name: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });

    if (!letter) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: letter });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const letter = await db.ssdLetter.findUnique({ where: { id, deletedAt: null } });
    if (!letter) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    if (letter.status !== "DRAFT")
      return NextResponse.json({ message: "Hanya surat berstatus DRAFT yang bisa diedit" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const { title, content, categoryId, departmentId, companyId, fileDraft } = body as {
      title?: string; content?: string;
      categoryId?: string; departmentId?: string; companyId?: string;
      fileDraft?: string;
    };

    const data = await db.ssdLetter.update({
      where: { id },
      data: {
        ...(title       ? { title: title.trim() }     : {}),
        ...(content     ? { content: content.trim() } : {}),
        ...(categoryId  ? { categoryId }  : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(companyId   ? { companyId }   : {}),
        ...(fileDraft !== undefined ? { fileDraft: fileDraft || null } : {}),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const letter = await db.ssdLetter.findUnique({ where: { id, deletedAt: null } });
    if (!letter) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    if (!["DRAFT", "REJECTED"].includes(letter.status))
      return NextResponse.json({ message: "Hanya surat DRAFT atau REJECTED yang bisa dihapus" }, { status: 400 });

    await db.ssdLetter.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
