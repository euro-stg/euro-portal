import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Edit & hapus Category Type (2026-11-12), superadmin-only. Aturan sama seperti Category:
// name selalu boleh diubah; code (segmen CATEGORY_TYPE_CODE di nomor dokumen) dan hapus hanya
// selama belum dipakai file yang belum dihapus. Hapus = soft delete, code diberi akhiran
// supaya code yang sama bisa dipakai lagi untuk type baru.

async function guard(id: string, typeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: unauthorized() };
  if (!(await isSuperadmin(session.user.id))) return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  const type = await db.eDocCategoryType.findFirst({ where: { id: typeId, categoryId: id, deletedAt: null, category: { deletedAt: null } } });
  if (!type) return { error: NextResponse.json({ message: "Category Type tidak ditemukan" }, { status: 404 }) };
  const fileCount = await db.eDocFile.count({ where: { categoryTypeId: typeId, deletedAt: null } });
  return { type, fileCount };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; typeId: string }> }) {
  try {
    const { id, typeId } = await params;
    const g = await guard(id, typeId);
    if ("error" in g) return g.error;

    const body = await request.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!code || !name) return NextResponse.json({ message: "Code dan name wajib diisi" }, { status: 400 });
    if (code !== g.type.code && g.fileCount > 0) {
      return NextResponse.json({ message: `Code tidak bisa diubah — sudah dipakai ${g.fileCount} file. Name tetap bisa diubah.` }, { status: 409 });
    }

    try {
      const data = await db.eDocCategoryType.update({ where: { id: typeId }, data: { code, name } });
      return NextResponse.json({ data });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return NextResponse.json({ message: "Code sudah dipakai untuk Category ini" }, { status: 409 });
      throw e;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; typeId: string }> }) {
  try {
    const { id, typeId } = await params;
    const g = await guard(id, typeId);
    if ("error" in g) return g.error;
    if (g.fileCount > 0) {
      return NextResponse.json({ message: `Category Type tidak bisa dihapus — masih dipakai ${g.fileCount} file.` }, { status: 409 });
    }

    const now = new Date();
    await db.eDocCategoryType.update({ where: { id: typeId }, data: { deletedAt: now, code: `${g.type.code}#deleted-${now.getTime()}` } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
