import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET(request: Request) {
  try {
    const appToken = request.headers.get("x-app-token");
    if (!appToken) return NextResponse.json({ error: "X-App-Token header diperlukan" }, { status: 401 });

    const appRecord = await db.appToken.findUnique({ where: { token: appToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt)
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")   ?? "1"));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const search = searchParams.get("search")?.trim() ?? "";
    const skip   = (page - 1) * limit;

    const where = {
      status: "active" as const,
      ...(search ? {
        OR: [
          { name:             { contains: search, mode: "insensitive" as const } },
          { employeeId:       { contains: search, mode: "insensitive" as const } },
          { email:            { contains: search, mode: "insensitive" as const } },
          { jobPositionName:  { contains: search, mode: "insensitive" as const } },
          { organizationName: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, employeeId: true, name: true, email: true, phone: true,
          jobPositionId: true, jobPositionName: true,
          organizationId: true, organizationName: true,
          branchId: true, branchName: true,
          age: true, joinDate: true, resignDate: true,
          status: true, image: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({ data: users, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[SSO Users]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
