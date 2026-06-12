import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  return NextResponse.json({ message: "Notifikasi ditandai dibaca" });
}
