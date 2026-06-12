import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ unread: 0 });

  const unread = await db.notification.count({ where: { userId: session.user.id, read: false, deletedAt: null } });
  return NextResponse.json({ unread });
}
