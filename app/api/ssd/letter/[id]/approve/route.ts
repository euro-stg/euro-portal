import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { createNotification, findStepUsers, notifyMany } from "@/lib/notifications";
import { generateLetterNumber } from "@/lib/ssd";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id: letterId } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, note } = body as { action?: string; note?: string };

    if (!action || !["APPROVED", "REJECTED"].includes(action))
      return NextResponse.json({ message: "Action harus APPROVED atau REJECTED" }, { status: 400 });

    const approval = await db.ssdApproval.findUnique({
      where: { letterId },
      include: { steps: { orderBy: { step: "asc" } } },
    });
    if (!approval) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    if (approval.status !== "PENDING")
      return NextResponse.json({ message: "Approval sudah selesai" }, { status: 400 });
    if (approval.submittedBy === userId)
      return NextResponse.json({ message: "Tidak bisa approve surat sendiri" }, { status: 403 });

    const me = await db.user.findUnique({
      where: { id: userId },
      select: { jobPositionId: true, organizationId: true, branchId: true },
    });
    if (!me) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });

    const activeStep = approval.steps.find(
      (s) => s.step === approval.currentStep && s.status === "PENDING"
    );
    if (!activeStep) return NextResponse.json({ message: "Tidak ada step aktif" }, { status: 400 });

    if (activeStep.jobPositionId && activeStep.jobPositionId !== me.jobPositionId)
      return NextResponse.json({ message: "Posisi jabatan tidak sesuai" }, { status: 403 });
    if (activeStep.organizationId && activeStep.organizationId !== me.organizationId)
      return NextResponse.json({ message: "Departemen tidak sesuai" }, { status: 403 });
    if (activeStep.branchId && activeStep.branchId !== me.branchId)
      return NextResponse.json({ message: "Branch tidak sesuai" }, { status: 403 });

    const isLastStep = approval.currentStep === approval.steps.length;

    // Generate letter number only if final approval
    let letterNo: string | undefined;
    if (action === "APPROVED" && isLastStep) {
      const letter = await db.ssdLetter.findUnique({
        where: { id: letterId },
        include: { category: true, organization: { select: { code: true } }, company: true },
      });
      if (letter) {
        letterNo = await generateLetterNumber(
          letter.category.code,
          letter.company.code,
          letter.organization?.code ?? "-",
          new Date(),
        );
      }
    }

    await db.$transaction(async (tx) => {
      await tx.ssdApprovalStep.update({
        where: { id: activeStep.id },
        data: { status: action, actorId: userId, note: note?.trim() || null, actedAt: new Date() },
      });

      if (action === "REJECTED") {
        await tx.ssdApproval.update({ where: { id: approval.id }, data: { status: "REJECTED", updatedAt: new Date() } });
        await tx.ssdLetter.update({ where: { id: letterId }, data: { status: "REJECTED", updatedAt: new Date() } });
        await tx.ssdActivity.create({
          data: { letterId, userId, action: "REJECTED", note: note?.trim() || `Ditolak pada Step ${approval.currentStep}: ${activeStep.label}` },
        });
      } else if (action === "APPROVED" && isLastStep) {
        await tx.ssdApproval.update({ where: { id: approval.id }, data: { status: "APPROVED", updatedAt: new Date() } });
        await tx.ssdLetter.update({
          where: { id: letterId },
          data: { status: "APPROVED", letterNo: letterNo ?? null, updatedAt: new Date() },
        });
        await tx.ssdActivity.create({
          data: { letterId, userId, action: "APPROVED", note: `Disetujui. Nomor surat: ${letterNo ?? "-"}` },
        });
      } else {
        await tx.ssdApproval.update({
          where: { id: approval.id },
          data: { currentStep: approval.currentStep + 1, updatedAt: new Date() },
        });
        await tx.ssdActivity.create({
          data: { letterId, userId, action: "APPROVED_STEP", note: `Step ${approval.currentStep} disetujui: ${activeStep.label}` },
        });
      }
    });

    // Notifications
    if (action === "REJECTED") {
      await createNotification(approval.submittedBy, "Surat Ditolak",
        `"${approval.title}" ditolak pada Step ${approval.currentStep}: ${activeStep.label}${note ? ` — ${note}` : ""}`,
        "APPROVAL_ACTION", letterId, "SSD");
    } else if (action === "APPROVED" && isLastStep) {
      await createNotification(approval.submittedBy, "Surat Disetujui",
        `"${approval.title}" telah disetujui semua approver. Nomor surat: ${letterNo ?? "-"}`,
        "APPROVAL_ACTION", letterId, "SSD");
    } else if (action === "APPROVED" && !isLastStep) {
      const nextStep = approval.steps.find((s) => s.step === approval.currentStep + 1);
      if (nextStep) {
        const nextApprovers = await findStepUsers(nextStep, userId);
        await notifyMany(nextApprovers, "Perlu Persetujuan Anda",
          `"${approval.title}" menunggu persetujuan Anda (Step ${nextStep.step}: ${nextStep.label})`,
          "APPROVAL_REQUEST", letterId, "SSD");
      }
    }

    return NextResponse.json({ message: action === "APPROVED" ? "Disetujui" : "Ditolak" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
