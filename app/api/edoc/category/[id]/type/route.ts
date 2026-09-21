import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const category = await db.eDocCategory.findFirst({ where: { id, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!code || !name) return NextResponse.json({ message: "Code dan name wajib diisi" }, { status: 400 });

    let categoryType;
    try {
      categoryType = await db.eDocCategoryType.create({ data: { categoryId: id, code, name } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ message: "Code sudah dipakai untuk Category ini" }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ data: categoryType }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
