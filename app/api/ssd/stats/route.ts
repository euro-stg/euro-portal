import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const [total, draft, submitted, approved, rejected, done, mine] = await Promise.all([
      db.ssdLetter.count({ where: { deletedAt: null } }),
      db.ssdLetter.count({ where: { deletedAt: null, status: "DRAFT" } }),
      db.ssdLetter.count({ where: { deletedAt: null, status: "SUBMITTED" } }),
      db.ssdLetter.count({ where: { deletedAt: null, status: "APPROVED" } }),
      db.ssdLetter.count({ where: { deletedAt: null, status: "REJECTED" } }),
      db.ssdLetter.count({ where: { deletedAt: null, status: "DONE" } }),
      db.ssdLetter.count({ where: { deletedAt: null, requestedBy: userId } }),
    ]);

    return NextResponse.json({ total, draft, submitted, approved, rejected, done, mine });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
