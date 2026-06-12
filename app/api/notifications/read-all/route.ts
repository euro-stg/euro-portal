import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await db.notification.updateMany({
    where: { userId: session.user.id, read: false, deletedAt: null },
    data: { read: true },
  });

  return NextResponse.json({ message: "Semua notifikasi ditandai dibaca" });
}
