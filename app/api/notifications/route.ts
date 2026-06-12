import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const base = { userId: session.user.id, deletedAt: null };

  const [notifications, total, unread] = await Promise.all([
    db.notification.findMany({
      where: base,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.notification.count({ where: base }),
    db.notification.count({ where: { ...base, read: false } }),
  ]);

  return NextResponse.json({ data: notifications, total, unread, page, limit });
}
