import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { name, active, steps } = body as {
      name?: string; active?: boolean;
      steps?: Array<{
        step: number; label: string;
        jobPositionId?: string; jobPositionName?: string;
        organizationId?: string; organizationName?: string;
        branchId?: string; branchName?: string;
      }>;
    };

    const existing = await db.sdApprovalTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    // Jika mengaktifkan template ini, nonaktifkan yang lain
    if (active === true) {
      await db.sdApprovalTemplate.updateMany({
        where: { active: true, deletedAt: null, id: { not: id } },
        data: { active: false },
      });
    }

    const updated = await db.sdApprovalTemplate.update({
      where: { id },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        ...(active !== undefined && { active }),
        updatedAt: new Date(),
        ...(steps && {
          steps: {
            deleteMany: {},
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
        }),
      },
      include: { steps: { orderBy: { step: "asc" } } },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await db.sdApprovalTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    const inUse = await db.sdApprovalRequest.count({ where: { templateId: id, status: "PENDING" } });
    if (inUse > 0)
      return NextResponse.json({ message: "Template masih digunakan oleh approval yang aktif" }, { status: 400 });

    await db.sdApprovalTemplate.update({ where: { id }, data: { deletedAt: new Date(), active: false } });

    return NextResponse.json({ message: "Template dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
