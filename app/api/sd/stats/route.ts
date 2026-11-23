import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["SUBMITTED", "IT_REVIEW", "APPROVED_IT", "APPROVED_USER", "IN_PROGRESS", "UAT", "UAT_REVISION"];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    // userId tetap dipakai untuk validasi auth, tapi hitungan adalah global
    void userId;

    const [total, done, inProgress] = await Promise.all([
      db.sdRequest.count({ where: { deletedAt: null } }),
      db.sdRequest.count({ where: { deletedAt: null, status: "DONE" } }),
      db.sdRequest.count({ where: { deletedAt: null, status: { in: ACTIVE_STATUSES } } }),
    ]);

    return NextResponse.json({ total, done, inProgress });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
