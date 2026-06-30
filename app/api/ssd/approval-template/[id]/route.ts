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
    const { active } = body as { active?: boolean };

    if (active === true) {
      await db.ssdApprovalTemplate.updateMany({
        where: { active: true, deletedAt: null, id: { not: id } },
        data: { active: false },
      });
    }

    const data = await db.ssdApprovalTemplate.update({
      where: { id },
      data: { ...(active !== undefined ? { active } : {}), updatedAt: new Date() },
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
    await db.ssdApprovalTemplate.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return NextResponse.json({ message: "Dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
