import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ total: 0, data: [] });
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const detail = searchParams.get("detail") === "true";

    const me = await db.user.findUnique({
      where: { id: userId },
      select: { jobPositionId: true, organizationId: true, branchId: true },
    });
    if (!me) return NextResponse.json({ total: 0, data: [] });

    const pendingApprovals = await db.ssdApproval.findMany({
      where: { status: "PENDING" },
      include: {
        steps: { orderBy: { step: "asc" } },
        letter: {
          include: {
            category: { select: { code: true, name: true } },
            department: { select: { code: true, name: true } },
            company: { select: { code: true, name: true } },
            requester: { select: { id: true, name: true, jobPositionName: true, organizationName: true } },
          },
        },
      },
    });

    const matching: typeof pendingApprovals = [];
    for (const approval of pendingApprovals) {
      if (approval.submittedBy === userId) continue;
      const activeStep = approval.steps.find(
        (s) => s.step === approval.currentStep && s.status === "PENDING"
      );
      if (!activeStep) continue;
      const matches =
        (!activeStep.jobPositionId || activeStep.jobPositionId === me.jobPositionId) &&
        (!activeStep.organizationId || activeStep.organizationId === me.organizationId) &&
        (!activeStep.branchId || activeStep.branchId === me.branchId);
      if (matches) matching.push(approval);
    }

    if (!detail) return NextResponse.json({ total: matching.length });

    const data = matching.map((approval) => {
      const activeStep = approval.steps.find(
        (s) => s.step === approval.currentStep && s.status === "PENDING"
      )!;
      return {
        approvalId: approval.id,
        letterId: approval.letter.id,
        title: approval.title,
        submittedBy: approval.letter.requester,
        currentStep: approval.currentStep,
        totalSteps: approval.steps.length,
        stepLabel: activeStep.label,
        stepJobPositionName: activeStep.jobPositionName,
        stepOrganizationName: activeStep.organizationName,
        stepBranchName: activeStep.branchName,
        category: approval.letter.category,
        department: approval.letter.department,
        company: approval.letter.company,
        createdAt: approval.createdAt,
      };
    });

    return NextResponse.json({ total: matching.length, data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ total: 0, data: [] });
  }
}
