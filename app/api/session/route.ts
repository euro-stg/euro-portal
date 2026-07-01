import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      employeeId: true,
      name: true,
      age: true,
      status: true,
      phone: true,
      mobilePhone: true,
      email: true,
      organizationName: true,
      jobPositionName: true,
      branchName: true,
      joinDate: true,
      resignDate: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}
