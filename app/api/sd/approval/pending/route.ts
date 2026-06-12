import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findUnique({
      where: { id: session.user.id },
      select: { jobPositionId: true, organizationId: true, branchId: true },
    });
    if (!me) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });

    const requests = await db.sdApprovalRequest.findMany({
      where: {
        status: "PENDING",
        submittedBy: { not: session.user.id },
        sdRequest: { status: { notIn: ["CANCELLED", "REJECTED", "DONE"] } },
      },
      include: {
        steps: { orderBy: { step: "asc" } },
        submitter: { select: { id: true, name: true, jobPositionName: true, organizationName: true } },
        sdRequest: { select: { id: true, requestNo: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const myPending = requests
      .map((req) => {
        const activeStep = req.steps.find((s) => s.step === req.currentStep && s.status === "PENDING");
        if (!activeStep) return null;

        if (activeStep.jobPositionId && activeStep.jobPositionId !== me.jobPositionId) return null;
        if (activeStep.organizationId && activeStep.organizationId !== me.organizationId) return null;
        if (activeStep.branchId && activeStep.branchId !== me.branchId) return null;

        return {
          approvalId: req.id,
          sdRequestId: req.sdRequestId,
          requestNo: req.sdRequest.requestNo,
          title: req.title,
          submittedBy: req.submitter,
          currentStep: req.currentStep,
          totalSteps: req.steps.length,
          stepLabel: activeStep.label,
          stepJobPositionName: activeStep.jobPositionName,
          stepOrganizationName: activeStep.organizationName,
          stepBranchName: activeStep.branchName,
          createdAt: req.createdAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ data: myPending, total: myPending.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
