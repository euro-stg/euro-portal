import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";

const VALID_TYPES = ["like", "appreciate", "congrats", "useful"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const { type } = await request.json().catch(() => ({}));

    if (!VALID_TYPES.includes(type))
      return NextResponse.json({ message: "Tipe reaction tidak valid" }, { status: 400 });

    const existing = await db.euReaction.findUnique({
      where: { targetType_targetId_userId: { targetType: "post", targetId: id, userId: session.user.id } },
    });

    if (existing) {
      if (existing.type === type) {
        // Toggle off — hapus reaction
        await db.euReaction.delete({ where: { id: existing.id } });
        return NextResponse.json({ data: null, message: "Reaction dihapus" });
      }
      // Ganti tipe reaction
      const updated = await db.euReaction.update({ where: { id: existing.id }, data: { type } });
      return NextResponse.json({ data: updated });
    }

    const reaction = await db.euReaction.create({
      data: { targetType: "post", targetId: id, userId: session.user.id, type },
    });
    return NextResponse.json({ data: reaction }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
