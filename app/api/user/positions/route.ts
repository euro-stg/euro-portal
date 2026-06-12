import { NextResponse } from "next/server";
import db from "@/lib/db/db";

// Distinct job positions + orgs + branches from User table
// Used for approval template step configuration
export async function GET() {
  try {
    const users = await db.user.findMany({
      where: { status: "active" },
      select: {
        jobPositionId: true, jobPositionName: true,
        organizationId: true, organizationName: true,
        branchId: true, branchName: true,
      },
    });

    // Distinct job positions
    const posMap = new Map<string, string>();
    const orgMap = new Map<string, string>();
    const branchMap = new Map<string, string>();

    for (const u of users) {
      if (u.jobPositionId && u.jobPositionName) posMap.set(u.jobPositionId, u.jobPositionName);
      if (u.organizationId && u.organizationName) orgMap.set(u.organizationId, u.organizationName);
      if (u.branchId && u.branchName) branchMap.set(u.branchId, u.branchName);
    }

    return NextResponse.json({
      positions:     Array.from(posMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      organizations: Array.from(orgMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      branches:      Array.from(branchMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
