import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const templates = await db.sdApprovalTemplate.findMany({
      where: { deletedAt: null },
      include: {
        steps: { orderBy: { step: "asc" } },
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: templates });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { name, steps } = body as {
      name?: string;
      steps?: Array<{
        step: number; label: string;
        jobPositionId?: string; jobPositionName?: string;
        organizationId?: string; organizationName?: string;
        branchId?: string; branchName?: string;
      }>;
    };

    if (!name?.trim()) return NextResponse.json({ message: "Nama wajib diisi" }, { status: 400 });
    if (!Array.isArray(steps) || steps.length === 0)
      return NextResponse.json({ message: "Minimal 1 step approval" }, { status: 400 });
    if (steps.some((s) => !s.label?.trim()))
      return NextResponse.json({ message: "Label setiap step wajib diisi" }, { status: 400 });

    // Hanya boleh ada 1 template aktif
    await db.sdApprovalTemplate.updateMany({
      where: { active: true, deletedAt: null },
      data: { active: false },
    });

    const template = await db.sdApprovalTemplate.create({
      data: {
        name: name.trim(),
        active: true,
        steps: {
          create: steps.map((s, i) => ({
            step: i + 1,
            label: s.label.trim(),
            jobPositionId: s.jobPositionId || null,
            jobPositionName: s.jobPositionName || null,
            organizationId: s.organizationId || null,
            organizationName: s.organizationName || null,
            branchId: s.branchId || null,
            branchName: s.branchName || null,
          })),
        },
      },
      include: { steps: { orderBy: { step: "asc" } } },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
