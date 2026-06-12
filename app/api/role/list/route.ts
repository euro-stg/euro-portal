import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name   = searchParams.get("name");
    const status = searchParams.get("status");
    const appId  = searchParams.get("appId");

    // appId=null → portal roles; appId=<id> → app-specific roles; omitted → all
    const appIdFilter =
      appId === "null" ? { appId: null }
      : appId          ? { appId }
      : {};

    const rows = await prisma.role.findMany({
      where: {
        deletedAt: null,
        ...appIdFilter,
        ...(name?.trim()   ? { name:   { contains: name.trim(),   mode: "insensitive" } } : {}),
        ...(status?.trim() ? { status: { equals:   status.trim() } } : {}),
      },
      include: { _count: { select: { modules: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
