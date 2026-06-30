import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { findStepUsers, notifyMany } from "@/lib/notifications";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id: letterId } = await params;
    const letter = await db.ssdLetter.findUnique({
      where: { id: letterId, deletedAt: null },
      include: { category: true, department: true, company: true },
    });
    if (!letter) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    if (letter.requestedBy !== userId)
      return NextResponse.json({ message: "Bukan milik Anda" }, { status: 403 });
    if (letter.status !== "DRAFT")
      return NextResponse.json({ message: "Hanya surat DRAFT yang bisa diajukan" }, { status: 400 });

    const template = await db.ssdApprovalTemplate.findFirst({
      where: { active: true, deletedAt: null },
      include: { steps: { orderBy: { step: "asc" } } },
    });
    if (!template || template.steps.length === 0)
      return NextResponse.json({ message: "Tidak ada template approval aktif" }, { status: 409 });

    await db.$transaction(async (tx) => {
      await tx.ssdLetter.update({ where: { id: letterId }, data: { status: "SUBMITTED", updatedAt: new Date() } });
      await tx.ssdApproval.create({
        data: {
          letterId,
          title: letter.title,
          submittedBy: userId,
          templateId: template.id,
          currentStep: 1,
          status: "PENDING",
          steps: {
            create: template.steps.map((s) => ({
              step: s.step,
              label: s.label,
              jobPositionId: s.jobPositionId,
              jobPositionName: s.jobPositionName,
              organizationId: s.organizationId,
              organizationName: s.organizationName,
              branchId: s.branchId,
              branchName: s.branchName,
              status: "PENDING",
            })),
          },
        },
      });
      await tx.ssdActivity.create({
        data: { letterId, userId, action: "SUBMITTED", note: "Surat diajukan untuk approval" },
      });
    });

    // Notify step 1 approvers
    const firstStep = template.steps[0];
    if (firstStep) {
      const approvers = await findStepUsers(firstStep, userId);
      if (approvers.length > 0) {
        await notifyMany(approvers, "Perlu Persetujuan Anda",
          `Surat "${letter.title}" menunggu persetujuan Anda (Step 1: ${firstStep.label})`,
          "APPROVAL_REQUEST", letterId, "SSD");
      }
    }

    return NextResponse.json({ message: "Surat berhasil diajukan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
