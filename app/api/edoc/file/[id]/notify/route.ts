import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canEditFileMetadata } from "@/lib/edoc";

// "Kriteria Email Blast" per file — GENUINELY INDEPENDEN dari EDocFileBlastFolder (lihat
// catatan di schema.prisma). Akses sama persis seperti /blast (uploader file ini ATAU
// canEditFileMetadata) — dua kemampuan ini memang dikonsep 1 paket ("creator selain bisa
// atur folder blast, bisa atur email blast juga"), jadi gerbangnya disamakan.
async function canManageNotify(userId: string, file: { folderId: string; uploadedBy: string; requiresNumber: boolean; bulkImported: boolean }): Promise<boolean> {
  if (file.uploadedBy === userId) return true;
  return canEditFileMetadata(userId, file);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const file = await db.eDocFile.findFirst({
      where: { id, deletedAt: null },
      select: { notifyBranchIds: true, notifyOrgIds: true, notifyPositionIds: true, notifyBusinessUnitCodes: true },
    });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    return NextResponse.json({
      data: {
        branchIds: file.notifyBranchIds, orgIds: file.notifyOrgIds,
        positionIds: file.notifyPositionIds, businessUnitCodes: file.notifyBusinessUnitCodes,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Full-replace ke-4 array sekaligus (bukan diff/tambah seperti /blast) — lebih sederhana,
// dan cocok dipakai dari 1 form yang selalu submit state lengkapnya.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, select: { folderId: true, uploadedBy: true, requiresNumber: true, bulkImported: true } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (!(await canManageNotify(userId, file))) {
      return NextResponse.json({ message: "Hanya pembuat file atau superadmin yang bisa mengatur kriteria email blast" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const toStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

    await db.eDocFile.update({
      where: { id },
      data: {
        notifyBranchIds: toStrArr((body as Record<string, unknown>)?.branchIds),
        notifyOrgIds: toStrArr((body as Record<string, unknown>)?.orgIds),
        notifyPositionIds: toStrArr((body as Record<string, unknown>)?.positionIds),
        notifyBusinessUnitCodes: toStrArr((body as Record<string, unknown>)?.businessUnitCodes),
      },
    });

    return NextResponse.json({ message: "Kriteria email blast diperbarui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
