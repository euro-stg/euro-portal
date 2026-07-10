import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";

const VALID_TYPES = ["like", "appreciate", "congrats", "useful"];

// targetId untuk birthday = "{userId}_{year}" e.g. "cm123_2026"
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { birthdayUserId, type } = await request.json().catch(() => ({}));
    if (!birthdayUserId) return NextResponse.json({ message: "birthdayUserId wajib diisi" }, { status: 400 });
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ message: "Tipe reaction tidak valid" }, { status: 400 });

    const year = new Date().getFullYear();
    const targetId = `${birthdayUserId}_${year}`;

    const existing = await db.euReaction.findUnique({
      where: { targetType_targetId_userId: { targetType: "birthday", targetId, userId: session.user.id } },
    });

    if (existing) {
      if (existing.type === type) {
        await db.euReaction.delete({ where: { id: existing.id } });
        return NextResponse.json({ data: null, message: "Reaction dihapus" });
      }
      const updated = await db.euReaction.update({ where: { id: existing.id }, data: { type } });
      return NextResponse.json({ data: updated });
    }

    const reaction = await db.euReaction.create({
      data: { targetType: "birthday", targetId, userId: session.user.id, type },
    });
    return NextResponse.json({ data: reaction }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
