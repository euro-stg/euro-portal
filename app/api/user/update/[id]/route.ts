import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

type UpdateBody = {
  name?: string;
  employeeId?: string;
  status?: string;
  role?: string;
  organizationName?: string | null;
  jobPositionName?: string | null;
  branchName?: string | null;
  age?: number | null;
  image?: string | null;
  joinDate?: string | null;
  resignDate?: string | null;
  password?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    if (!await requireSession()) return unauthorized();
    const rawParams = await context.params;

    const id =
      typeof rawParams === "object" && rawParams !== null && "id" in rawParams
        ? (rawParams as { id: string }).id
        : undefined;

    if (!id) {
      return NextResponse.json({ message: "ID is required" }, { status: 400 });
    }

    const body: UpdateBody = await request.json().catch(() => ({}));

    /* =========================
       ✅ GET EXISTING DATA
    ========================= */
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ message: "Data not found" }, { status: 404 });
    }

    /* =========================
       ✅ VALIDATE BASIC
    ========================= */
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json(
        { message: "Name cannot be empty" },
        { status: 400 },
      );
    }

    /* =========================
       ✅ PASSWORD
    ========================= */
    let hashedPassword: string | undefined;

    if (body.password && body.password.trim()) {
      hashedPassword = await bcrypt.hash(body.password, 10);
    }

    /* =========================
       ✅ BUILD UPDATE DATA
    ========================= */
    const updateData = {
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      employeeId:
        body.employeeId !== undefined
          ? String(body.employeeId).trim()
          : existing.employeeId,
      status:
        body.status !== undefined
          ? String(body.status).trim()
          : existing.status,
      organizationName:
        body.organizationName !== undefined
          ? body.organizationName
            ? String(body.organizationName).trim()
            : null
          : existing.organizationName,
      jobPositionName:
        body.jobPositionName !== undefined
          ? body.jobPositionName
            ? String(body.jobPositionName).trim()
            : null
          : existing.jobPositionName,
      branchName:
        body.branchName !== undefined
          ? body.branchName
            ? String(body.branchName).trim()
            : null
          : existing.branchName,
      age:
        body.age !== undefined
          ? body.age != null && !isNaN(Number(body.age))
            ? Number(body.age)
            : null
          : existing.age,
      image: body.image !== undefined ? body.image : existing.image,
      joinDate:
        body.joinDate !== undefined
          ? body.joinDate
            ? new Date(body.joinDate)
            : null
          : existing.joinDate,
      resignDate:
        body.resignDate !== undefined
          ? body.resignDate
            ? new Date(body.resignDate)
            : null
          : existing.resignDate,
      ...(hashedPassword && { password: hashedPassword }),
    };

    /* =========================
       ✅ UPDATE PORTAL ROLE (via UserRole)
    ========================= */
    if (body.role !== undefined && body.role.trim()) {
      const roleName = body.role.trim();
      const portalRole = await prisma.role.findFirst({
        where: { name: roleName, appId: null, status: "active", deletedAt: null },
      });
      if (portalRole) {
        await prisma.userRole.deleteMany({ where: { userId: id, appId: null } });
        await prisma.userRole.create({ data: { userId: id, roleId: portalRole.id, appId: null } });
      }
    }

    /* =========================
       ✅ UPDATE USER
    ========================= */
    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        employeeId: true,
        name: true,
        status: true,
        userRoles: {
          select: { role: { select: { name: true, appId: true } } },
          orderBy: { createdAt: "asc" },
        },
        organizationName: true,
        jobPositionName: true,
        branchName: true,
        age: true,
        image: true,
        joinDate: true,
        resignDate: true,
      },
    });

    /* =========================
       ✅ OUTPUT FLATTEN
    ========================= */
    const { userRoles, ...updatedRest } = updated;
    const response = {
      ...updatedRest,
      role: userRoles.find((ur) => ur.role.appId === null)?.role.name ?? null,
      roles: userRoles.map((ur) => ({ name: ur.role.name, appId: ur.role.appId })),
      joinDate: updated.joinDate ? updated.joinDate.toISOString() : null,
      resignDate: updated.resignDate ? updated.resignDate.toISOString() : null,
    };

    return NextResponse.json(
      {
        message: "Update User successful",
        data: response,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
