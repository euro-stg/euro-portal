import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const isSuperadmin = await db.userRole.findFirst({
    where: { userId: session.user.id, role: { appId: null, name: "superadmin", status: "active", deletedAt: null } },
  });
  if (!isSuperadmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const appTokenId = searchParams.get("appTokenId") ?? undefined;
  const status     = searchParams.get("status") ?? undefined;
  const page       = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit      = 20;

  const where = {
    ...(appTokenId ? { appTokenId } : {}),
    ...(status     ? { status }     : {}),
  };

  const [rows, total] = await Promise.all([
    db.apiLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        appToken: { select: { id: true, name: true } },
      },
    }),
    db.apiLog.count({ where }),
  ]);

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const users   = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, employeeId: true } })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const data = rows.map((r) => ({
    ...r,
    user: r.userId ? (userMap[r.userId] ?? null) : null,
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / limit) });
}
