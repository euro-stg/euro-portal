import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();
    const { searchParams } = new URL(request.url);
    const name       = searchParams.get("name");
    const status     = searchParams.get("status");
    const type       = searchParams.get("type");
    const appId      = searchParams.get("appId");
    const isExternal = searchParams.get("isExternal");

    const appIdFilter =
      appId === "null" ? { appId: null }
      : appId          ? { appId }
      : {};

    const rows = await prisma.module.findMany({
      where: {
        deletedAt: null,
        ...appIdFilter,
        ...(name?.trim()       ? { name:       { contains: name.trim(), mode: "insensitive" } } : {}),
        ...(status?.trim()     ? { status:     { equals: status.trim() } } : {}),
        ...(type?.trim()       ? { type:       { equals: type.trim()   } } : {}),
        ...(isExternal === "true"  ? { isExternal: true  } : {}),
        ...(isExternal === "false" ? { isExternal: false } : {}),
      },
      orderBy: [{ group: "asc" }, { order: "asc" }],
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
