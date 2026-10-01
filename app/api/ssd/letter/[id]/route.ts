import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { deleteFromNextcloud } from "@/lib/nextcloud";

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
        company: true,
        organization: { select: { id: true, name: true, code: true, parentOrganizationId: true } },
        requester: { select: { id: true, name: true, jobPositionName: true, organizationName: true, branchName: true } },
        pic: { select: { id: true, name: true, jobPositionName: true } },
        approval: {
          include: {
            steps: { orderBy: { step: "asc" }, include: { actor: { select: { id: true, name: true } } } },
            template: { select: { id: true, name: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "asc" },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });

    if (!letter) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    const me = await db.user.findUnique({
      where: { id: session.user.id },
      select: { jobPositionId: true, organizationId: true, branchId: true },
    });

    const activeStep = letter.approval?.steps.find(
      (s) => s.step === letter.approval?.currentStep && s.status === "PENDING"
    );

    const isApprover =
      !!me &&
      !!activeStep &&
      letter.approval?.status === "PENDING" &&
      letter.requestedBy !== session.user.id &&
      (!activeStep.jobPositionId || activeStep.jobPositionId === me.jobPositionId) &&
      (!activeStep.organizationId || activeStep.organizationId === me.organizationId) &&
      (!activeStep.branchId || activeStep.branchId === me.branchId);

    return NextResponse.json({
      data: letter,
      isOwner: letter.requestedBy === session.user.id,
      isApprover,
    });
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
    const { title, tujuan, picId, categoryId, companyId, fileDraft } = body as {
      title?: string; tujuan?: string; picId?: string;
      categoryId?: string; companyId?: string; fileDraft?: string;
    };

    const data = await db.ssdLetter.update({
      where: { id },
      data: {
        ...(title        ? { title: title.trim() }         : {}),
        ...(tujuan !== undefined ? { tujuan: tujuan?.trim() || null } : {}),
        ...(picId  !== undefined ? { picId: picId || null }          : {}),
        ...(categoryId   ? { categoryId }   : {}),
        ...(companyId    ? { companyId }    : {}),
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
    if (letter.status !== "DRAFT")
      return NextResponse.json({ message: "Hanya surat berstatus DRAFT yang bisa dihapus" }, { status: 400 });

    // Urutan disamakan dengan E Doc (2026-10-01, sebelumnya kebalik — DB ditandai terhapus
    // DULU baru coba hapus fisik, kegagalan fisiknya didiamkan total lewat .catch(() => {})
    // — kalau Nextcloud lagi mati, user melihat "Dihapus" sukses padahal file fisiknya jadi
    // yatim/orphan selamanya). Sekarang: hapus fisik DULU, DB cuma ditandai terhapus kalau
    // itu benar-benar berhasil (atau tidak ada file sama sekali).
    if (letter.fileDraft) {
      try {
        await deleteFromNextcloud(letter.fileDraft);
      } catch (e) {
        console.error("[ssd] gagal menghapus file fisik di Nextcloud", e);
        return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal menghapus file di Nextcloud — surat TIDAK ditandai terhapus, coba lagi nanti" }, { status: 502 });
      }
    }
    await db.ssdLetter.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
