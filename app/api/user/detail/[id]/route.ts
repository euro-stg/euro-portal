import { NextResponse } from "next/server";

import prisma from "@/lib/db/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const row = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        name: true,
        joinDate: true,
        resignDate: true,
        status: true,
        organizationId: true,
        organizationName: true,
        jobPositionId: true,
        jobPositionName: true,
        branchId: true,
        branchName: true,
        age: true,
        phone: true,
        mobilePhone: true,
        email: true,
        userRoles: {
          select: { role: { select: { name: true, appId: true } } },
          orderBy: { createdAt: "asc" },
        },
        image: true,
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
