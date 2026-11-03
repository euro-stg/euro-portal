import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageImItems, searchMasterItems } from "@/lib/im-check";

// Cari Master Item (kode/nama) untuk pemetaan SKU item lama (2026-11-02). ?q=
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    return NextResponse.json({ data: await searchMasterItems(new URL(request.url).searchParams.get("q") ?? "") });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
