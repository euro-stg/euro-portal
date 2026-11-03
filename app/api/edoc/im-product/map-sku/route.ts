import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageImItems, mapProductSkus } from "@/lib/im-check";

// Simpan pemetaan SKU item lama (2026-11-02). JSON { mappings: [{ productId, itemCode }] }.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { mappings?: unknown } | null;
    const result = await mapProductSkus(body?.mappings, session.user.id);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
