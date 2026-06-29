import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search")?.trim() ?? "";
  const branchId = searchParams.get("branchId")?.trim() ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page")   ?? "1"));
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip     = (page - 1) * limit;

  const where = {
    ...(branchId ? { branchId } : {}),
    ...(search
      ? {
          OR: [
            { name:        { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.jobPosition.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.jobPosition.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}
