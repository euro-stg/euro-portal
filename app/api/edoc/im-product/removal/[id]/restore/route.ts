import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageImItems, restoreRemoval } from "@/lib/im-check";

// Kembalikan item yang dikeluarkan ke IM asalnya (2026-11-02).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const { id } = await params;
    const result = await restoreRemoval(id, session.user.id);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
