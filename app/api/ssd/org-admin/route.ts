import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

export async function GET() {
  try {
    if (!await requireSession()) return unauthorized();

    const admins = await db.ssdOrgAdmin.findMany({
      include: {
        user: { select: { id: true, name: true, employeeId: true, jobPositionName: true } },
        organization: { select: { id: true, name: true, parentOrganizationId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: admins });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const { userId, organizationId } = body as { userId?: string; organizationId?: string };

    if (!userId) return NextResponse.json({ message: "User wajib dipilih" }, { status: 400 });
    if (!organizationId) return NextResponse.json({ message: "Organization wajib dipilih" }, { status: 400 });

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });

    const org = await db.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
    if (!org) return NextResponse.json({ message: "Organization tidak ditemukan" }, { status: 404 });

    const existing = await db.ssdOrgAdmin.findUnique({ where: { userId } });
    if (existing) {
      // Update org assignment jika user sudah punya assignment lain
      const updated = await db.ssdOrgAdmin.update({
        where: { userId },
        data: { organizationId },
        include: {
          user: { select: { id: true, name: true, employeeId: true, jobPositionName: true } },
          organization: { select: { id: true, name: true, parentOrganizationId: true } },
        },
      });
      return NextResponse.json({ data: updated });
    }

    const admin = await db.ssdOrgAdmin.create({
      data: { userId, organizationId },
      include: {
        user: { select: { id: true, name: true, employeeId: true, jobPositionName: true } },
        organization: { select: { id: true, name: true, parentOrganizationId: true } },
      },
    });

    return NextResponse.json({ data: admin }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
