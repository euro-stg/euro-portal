import { NextResponse } from "next/server";

import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { buildUserListWhere, calcAge } from "@/lib/user-query";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();

    const { searchParams } = new URL(request.url);

    const all  = searchParams.get("all") === "true";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

    const where = buildUserListWhere(searchParams);

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          name: true,
          status: true,
          source: true,
          userRoles: {
            select: { role: { select: { name: true, appId: true } } },
            orderBy: { createdAt: "asc" },
          },
          organizationName: true,
          jobPositionName: true,
          branchName: true,
          birthDate: true,
          image: true,
          joinDate: true,
          resignDate: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
        ...(all ? {} : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      }),
      prisma.user.count({ where }),
    ]);

    const data = rows.map(({ userRoles, birthDate, ...row }) => ({
      ...row,
      age: calcAge(birthDate),
      role: userRoles.find((ur) => ur.role.appId === null)?.role.name ?? null,
      roles: userRoles.map((ur) => ({ name: ur.role.name, appId: ur.role.appId })),
      joinDate:   row.joinDate   ? (row.joinDate   as Date).toISOString() : null,
      resignDate: row.resignDate ? (row.resignDate as Date).toISOString() : null,
      createdAt:  (row.createdAt  as Date).toISOString(),
      updatedAt:  (row.updatedAt  as Date).toISOString(),
    }));

    return NextResponse.json({
      data,
      meta: {
        total,
        page: all ? 1 : page,
        pageSize: all ? total : PAGE_SIZE,
        totalPages: all ? 1 : Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (error) {
    console.error("error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
