import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canEditFileMetadata, canViewFile, isSuperadmin } from "@/lib/edoc";
import { createReplacements, getReplacementInfo, parseReplacementInput, validateReplacements } from "@/lib/im-replacement";

// Penggantian IM (2026-11-05) — lihat app/lib/im-replacement.ts.
//   GET                          → { replaces, replacedBy, canManage }
//   POST { oldFileId, obsoleteFolderId? } → tautkan IM lama yang digantikan IM ini
//   DELETE ?oldFileId=           → lepas tautan (hanya yang belum diterapkan)
// Kelola tautan: yang boleh edit metadata IM ini, selama belum Release (sesudahnya superadmin).

async function load(userId: string, id: string) {
  const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, include: { category: { select: { code: true } } } });
  if (!file) return { error: NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 }) };
  if (!(await canViewFile(userId, file))) return { error: NextResponse.json({ message: "Anda tidak memiliki akses ke file ini" }, { status: 403 }) };
  const canManage = file.category.code === "IM" && (await canEditFileMetadata(userId, file)) && (file.status !== "RELEASE" || (await isSuperadmin(userId)));
  return { file, canManage };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const { id } = await params;
    const r = await load(session.user.id, id);
    if ("error" in r) return r.error;
    return NextResponse.json({ ...(await getReplacementInfo(session.user.id, id)), canManage: r.canManage });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const { id } = await params;
    const r = await load(session.user.id, id);
    if ("error" in r) return r.error;
    if (!r.canManage) return NextResponse.json({ message: "Anda tidak bisa mengubah IM yang digantikan untuk file ini" }, { status: 403 });
    const links = parseReplacementInput([await request.json().catch(() => null)]);
    if ("error" in links) return NextResponse.json({ message: links.error }, { status: 400 });
    const err = await validateReplacements(id, links);
    if (err) return NextResponse.json({ message: err }, { status: 400 });
    await db.$transaction((tx) => createReplacements(tx, id, links, session.user!.id!));
    return NextResponse.json(await getReplacementInfo(session.user.id, id), { status: 201 });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return NextResponse.json({ message: "IM itu baru saja digantikan oleh IM lain" }, { status: 409 });
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const { id } = await params;
    const r = await load(session.user.id, id);
    if ("error" in r) return r.error;
    if (!r.canManage) return NextResponse.json({ message: "Anda tidak bisa mengubah IM yang digantikan untuk file ini" }, { status: 403 });
    const oldFileId = new URL(request.url).searchParams.get("oldFileId") ?? "";
    const rep = await db.eDocFileReplacement.findFirst({ where: { newFileId: id, oldFileId } });
    if (!rep) return NextResponse.json({ message: "Tautan tidak ditemukan" }, { status: 404 });
    if (rep.appliedAt) return NextResponse.json({ message: "Penggantian sudah diterapkan (end date IM lama sudah diubah) — tautan tidak bisa dilepas" }, { status: 400 });
    await db.eDocFileReplacement.delete({ where: { id: rep.id } });
    return NextResponse.json(await getReplacementInfo(session.user.id, id));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
