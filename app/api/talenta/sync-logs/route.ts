import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "user" | "branch" | "job_position" | null (all)

  const logs = await prisma.syncLog.findMany({
    where: type ? { type } : undefined,
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ data: logs });
}
