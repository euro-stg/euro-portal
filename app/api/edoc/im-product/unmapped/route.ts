import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageImItems, listUnmapped } from "@/lib/im-check";

// Item lama tanpa SKU di IM aktif + saran SKU by nama (2026-11-02). ?q= &page=
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    return NextResponse.json(await listUnmapped(sp.get("q")?.trim() ?? "", page));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
