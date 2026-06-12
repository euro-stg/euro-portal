import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

// Simple user list for PIC selection in SD requests
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const users = await db.user.findMany({
      where: {
        status: "active",
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { jobPositionName: { contains: q, mode: "insensitive" } },
            { organizationName: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        jobPositionName: true,
        organizationName: true,
        branchName: true,
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
