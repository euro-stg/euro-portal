import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const result = await db.notification.updateMany({
    where: { userId: session.user.id, read: true, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ message: "Notifikasi yang sudah dibaca dihapus", count: result.count });
}
