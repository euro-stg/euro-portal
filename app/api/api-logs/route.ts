import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

async function requireSuperadmin(userId: string) {
  return db.userRole.findFirst({
    where: { userId, role: { appId: null, name: "superadmin", status: "active", deletedAt: null } },
  });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const isSuperadmin = await requireSuperadmin(session.user.id);
  if (!isSuperadmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const appTokenId = searchParams.get("appTokenId") ?? undefined;
  const endpoint   = searchParams.get("endpoint") ?? undefined;
  const status     = searchParams.get("status") ?? undefined;
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");
  const page       = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limitRaw   = Number(searchParams.get("limit") ?? 10);
  const limit      = [10, 100, 1000].includes(limitRaw) ? limitRaw : 10;

  const where = {
    ...(appTokenId ? { appTokenId } : {}),
    ...(endpoint   ? { endpoint: { contains: endpoint, mode: "insensitive" as const } } : {}),
    ...(status     ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
            ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999Z`)   } : {}),
          },
        }
      : {}),
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

  const data = rows.map((r) => ({ ...r, user: r.userId ? (userMap[r.userId] ?? null) : null }));

  return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const isSuperadmin = await requireSuperadmin(session.user.id);
  if (!isSuperadmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { dateFrom, dateTo } = body as { dateFrom?: string; dateTo?: string };

  if (!dateFrom && !dateTo) {
    return NextResponse.json({ message: "dateFrom atau dateTo diperlukan" }, { status: 400 });
  }

  const where = {
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
            ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999Z`)   } : {}),
          },
        }
      : {}),
  };

  const { count } = await db.apiLog.deleteMany({ where });
  return NextResponse.json({ deleted: count });
}
