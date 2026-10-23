import { NextResponse } from "next/server";

import prisma from "@/lib/db/db";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import { calcAge } from "@/lib/user-query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.user]))) return forbidden();
    const { id } = await params;

    const row = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        name: true,
        source: true,
        joinDate: true,
        resignDate: true,
        status: true,
        organizationId: true,
        organizationName: true,
        jobPositionId: true,
        jobPositionName: true,
        branchId: true,
        branchName: true,
        phone: true,
        mobilePhone: true,
        email: true,
        image: true,
        lastName: true,
        gender: true,
        birthPlace: true,
        birthDate: true,
        address: true,
        religion: true,
        bloodType: true,
        maritalStatus: true,
        identityType: true,
        identityNumber: true,
        jobLevel: true,
        employmentStatus: true,
        userRoles: {
          select: { role: { select: { name: true, appId: true } } },
          orderBy: { createdAt: "asc" },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return NextResponse.json({ message: "Data not found" }, { status: 404 });
    }

    const { userRoles, ...rest } = row;
    return NextResponse.json(
      {
        message: "OK",
        data: {
          ...rest,
          age: calcAge(rest.birthDate),
          role: userRoles.find((ur) => ur.role.appId === null)?.role.name ?? null,
          roles: userRoles.map((ur) => ({ name: ur.role.name, appId: ur.role.appId })),
          createdAt: row.createdAt ? row.createdAt.toISOString() : null,
          updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
        },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
