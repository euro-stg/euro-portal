import { NextResponse } from "next/server";

import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function GET() {
  try {
    if (!await requireSession()) return unauthorized();
    const total = await prisma.user.count();
    return NextResponse.json({ total });
  } catch (error) {
    console.error("error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
