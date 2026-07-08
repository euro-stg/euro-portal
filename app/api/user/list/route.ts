import { NextResponse } from "next/server";

import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

const PAGE_SIZE = 10;

function parseAgeFilter(raw: string | null) {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;

  if (v.includes("-")) {
    const [a, b] = v.split("-").map((x) => Number(x.trim()));
    if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
    return { gte: Math.min(a, b), lte: Math.max(a, b) };
  }

  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  return { equals: n };
}

function parseDateFilter(raw: string | null) {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;

  const date = new Date(`${v}T00:00:00.000Z`);
  if (isNaN(date.getTime())) return undefined;

  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);

  return { gte: date, lt: next };
}

export async function GET(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();

    const { searchParams } = new URL(request.url);

    const all  = searchParams.get("all") === "true";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

    const name = searchParams.get("name");
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const roleId = searchParams.get("roleId");
    const organizationName = searchParams.get("organizationName");
    const jobPositionName = searchParams.get("jobPositionName");
    const branchName = searchParams.get("branchName");
    const ageFilter = parseAgeFilter(searchParams.get("age"));
    const joinDateFilter = parseDateFilter(searchParams.get("joinDate"));
    const resignDateFilter = parseDateFilter(searchParams.get("resignDate"));

    const where = {
      ...(name
        ? { name: { contains: name, mode: "insensitive" as const } }
        : {}),
      ...(employeeId
        ? { employeeId: { contains: employeeId, mode: "insensitive" as const } }
        : {}),
      ...(status
        ? { status: { contains: status, mode: "insensitive" as const } }
        : {}),
      ...(roleId ? { userRoles: { some: { roleId } } } : {}),
      ...(organizationName
        ? {
            organizationName: {
              contains: organizationName,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(jobPositionName
        ? {
            jobPositionName: {
              contains: jobPositionName,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(branchName
        ? {
            branchName: {
              contains: branchName,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(ageFilter ? { age: ageFilter } : {}),
      ...(joinDateFilter ? { joinDate: joinDateFilter } : {}),
      ...(resignDateFilter ? { resignDate: resignDateFilter } : {}),
    };

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
          age: true,
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

    const data = rows.map(({ userRoles, ...row }) => ({
      ...row,
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
