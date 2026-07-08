import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const orgAdmin = await db.ssdOrgAdmin.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { id: true, name: true, code: true, parentOrganizationId: true } },
      },
    });

    return NextResponse.json({ data: orgAdmin ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
