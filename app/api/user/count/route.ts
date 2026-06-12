import { NextResponse } from "next/server";

import prisma from "@/lib/db/db";

export async function GET() {
  try {
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
