import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { createNotification, notifyMany, findStepUsers } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id: approvalId } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, note } = body as { action?: string; note?: string };

    if (!action || !["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json({ message: "Action harus APPROVED atau REJECTED" }, { status: 400 });
    }

    const approvalReq = await db.sdApprovalRequest.findUnique({
      where: { id: approvalId },
      include: { steps: { orderBy: { step: "asc" } } },
    });

    if (!approvalReq) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    if (approvalReq.status !== "PENDING")
      return NextResponse.json({ message: "Approval sudah selesai" }, { status: 400 });

    const parentRequest = await db.sdRequest.findUnique({ where: { id: approvalReq.sdRequestId }, select: { status: true } });
    if (!parentRequest) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (["CANCELLED", "REJECTED", "DONE"].includes(parentRequest.status))
      return NextResponse.json({ message: "Pengajuan sudah selesai atau dibatalkan, tidak bisa diproses" }, { status: 409 });

    if (approvalReq.submittedBy === userId)
      return NextResponse.json({ message: "Tidak bisa approve pengajuan sendiri" }, { status: 403 });

    const me = await db.user.findUnique({
      where: { id: userId },
      select: { jobPositionId: true, organizationId: true, branchId: true },
    });
    if (!me) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });

    const activeStep = approvalReq.steps.find(
      (s) => s.step === approvalReq.currentStep && s.status === "PENDING"
    );
    if (!activeStep) return NextResponse.json({ message: "Tidak ada step aktif" }, { status: 400 });

    if (activeStep.jobPositionId && activeStep.jobPositionId !== me.jobPositionId)
      return NextResponse.json({ message: "Posisi jabatan tidak sesuai" }, { status: 403 });
    if (activeStep.organizationId && activeStep.organizationId !== me.organizationId)
      return NextResponse.json({ message: "Departemen tidak sesuai" }, { status: 403 });
    if (activeStep.branchId && activeStep.branchId !== me.branchId)
      return NextResponse.json({ message: "Branch tidak sesuai" }, { status: 403 });

    const isLastStep = approvalReq.currentStep === approvalReq.steps.length;
    const sdRequestId = approvalReq.sdRequestId;

    await db.$transaction(async (tx) => {
      await tx.sdApprovalRequestStep.update({
        where: { id: activeStep.id },
        data: { status: action, actorId: userId, note: note?.trim() || null, actedAt: new Date() },
      });

      if (action === "REJECTED") {
        await tx.sdApprovalRequest.update({
          where: { id: approvalId },
          data: { status: "REJECTED", updatedAt: new Date() },
        });
        await tx.sdRequest.update({
          where: { id: sdRequestId },
          data: { status: "REJECTED", updatedAt: new Date() },
        });
        await tx.sdActivity.create({
          data: { requestId: sdRequestId, userId, action: "REJECTED", note: "Ditolak pada tahap approval" },
        });
      } else if (action === "APPROVED" && isLastStep) {
        await tx.sdApprovalRequest.update({
          where: { id: approvalId },
          data: { status: "APPROVED", updatedAt: new Date() },
        });
        await tx.sdRequest.update({
          where: { id: sdRequestId },
          data: { status: "IT_REVIEW", updatedAt: new Date() },
        });
        await tx.sdActivity.create({
          data: { requestId: sdRequestId, userId, action: "IT_REVIEW", note: "Semua approval selesai, IT mulai review" },
        });
      } else {
        await tx.sdApprovalRequest.update({
          where: { id: approvalId },
          data: { currentStep: approvalReq.currentStep + 1, updatedAt: new Date() },
        });
      }
    });

    // Notifikasi setelah transaksi selesai
    const reqTitle = approvalReq.title;
    if (action === "REJECTED") {
      await createNotification(approvalReq.submittedBy, "Pengajuan Ditolak pada Proses Approval",
        `"${reqTitle}" ditolak pada Step ${approvalReq.currentStep}: ${activeStep.label}`,
        "APPROVAL_ACTION", sdRequestId, "SD");
    } else if (action === "APPROVED" && isLastStep) {
      // Semua approval selesai → notify PIC jika sudah di-assign
      const sdReq = await db.sdRequest.findUnique({ where: { id: sdRequestId }, select: { picId: true, requestedBy: true } });
      if (sdReq?.picId) {
        await createNotification(sdReq.picId, "Pengajuan Siap Direview",
          `"${reqTitle}" telah melalui semua approval dan siap untuk direview`,
          "APPROVAL_ACTION", sdRequestId, "SD");
      }
      await createNotification(approvalReq.submittedBy, "Semua Approval Selesai",
        `"${reqTitle}" telah disetujui semua approver dan masuk ke tahap Review IT`,
        "APPROVAL_ACTION", sdRequestId, "SD");
    } else if (action === "APPROVED" && !isLastStep) {
      // Notify approver step berikutnya
      const nextStep = approvalReq.steps.find((s) => s.step === approvalReq.currentStep + 1);
      if (nextStep) {
        const nextApprovers = await findStepUsers(nextStep, userId);
        await notifyMany(nextApprovers, "Perlu Persetujuan Anda",
          `"${reqTitle}" menunggu persetujuan Anda (Step ${nextStep.step}: ${nextStep.label})`,
          "APPROVAL_REQUEST", sdRequestId, "SD");
      }
    }

    return NextResponse.json({ message: `Step ${action === "APPROVED" ? "disetujui" : "ditolak"}` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
