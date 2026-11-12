import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Edit & hapus Category (2026-11-12), superadmin-only seperti master data lainnya.
//   - Name: selalu boleh diubah.
//   - Code: hanya selama belum ada file (yang belum dihapus) memakai Category ini — code ikut
//     membentuk Document/MOC Number (segmen CATEGORY_CODE) dan "IM" dipakai langsung di logika
//     item promo & penggantian IM, jadi mengubahnya setelah dipakai bisa bikin data tidak konsisten.
//   - Hapus: ditolak kalau masih dipakai file. Soft delete (file yang sudah dihapus masih
//     merujuknya, FK RESTRICT) + code diberi akhiran supaya code-nya bisa dipakai lagi.

async function guard(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: unauthorized() };
  if (!(await isSuperadmin(session.user.id))) return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  const category = await db.eDocCategory.findFirst({ where: { id, deletedAt: null } });
  if (!category) return { error: NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 }) };
  const fileCount = await db.eDocFile.count({ where: { categoryId: id, deletedAt: null } });
  return { category, fileCount };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await guard(id);
    if ("error" in g) return g.error;

    const body = await request.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!code || !name) return NextResponse.json({ message: "Code dan name wajib diisi" }, { status: 400 });
    if (code !== g.category.code && g.fileCount > 0) {
      return NextResponse.json({ message: `Code tidak bisa diubah — sudah dipakai ${g.fileCount} file. Name tetap bisa diubah.` }, { status: 409 });
    }

    try {
      const data = await db.eDocCategory.update({ where: { id }, data: { code, name, updatedAt: new Date() } });
      return NextResponse.json({ data });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return NextResponse.json({ message: "Code sudah dipakai" }, { status: 409 });
      throw e;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await guard(id);
    if ("error" in g) return g.error;
    if (g.fileCount > 0) {
      return NextResponse.json({ message: `Category tidak bisa dihapus — masih dipakai ${g.fileCount} file. Pindahkan/ubah Category file-file itu dulu.` }, { status: 409 });
    }

    const now = new Date();
    await db.eDocCategory.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now, code: `${g.category.code}#deleted-${now.getTime()}` },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
