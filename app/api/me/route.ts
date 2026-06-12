import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ id: null }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      jobPositionId: true,
      organizationId: true,
      branchId: true,
      userRoles: {
        select: {
          role: { select: { name: true, appId: true } },
        },
        where: { role: { status: "active", deletedAt: null } },
      },
    },
  });

  if (!user) return NextResponse.json({ id: null }, { status: 401 });

  const portalRole = user.userRoles.find((ur) => ur.role.appId === null)?.role.name ?? null;
  const hasAnyAppRole = user.userRoles.some((ur) => ur.role.appId !== null);

  return NextResponse.json({
    id: user.id,
    jobPositionId: user.jobPositionId,
    organizationId: user.organizationId,
    branchId: user.branchId,
    role: portalRole,
    hasAnyAppRole,
  });
}
