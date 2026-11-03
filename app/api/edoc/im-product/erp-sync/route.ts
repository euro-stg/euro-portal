import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { ErpError } from "@/lib/erp";
import { canManageImItems } from "@/lib/im-check";
import { buildErpProposals, saveErpProposals } from "@/lib/im-erp-sync";

export const maxDuration = 120;

// Sync Item ke IM dari ERP (2026-11-03) — lihat app/lib/im-erp-sync.ts.
//   GET  ?itemCode=   → usulan baris per IM portal + IM ERP yang tidak ditemukan di portal
//   POST { itemCode, entries: [{ fileId, action, productId?, product }] } → simpan hasil review
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const itemCode = new URL(request.url).searchParams.get("itemCode")?.trim();
    if (!itemCode) return NextResponse.json({ message: "Pilih item dulu" }, { status: 400 });
    const result = await buildErpProposals(itemCode);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status ?? 400 });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ErpError) return NextResponse.json({ message: err.message }, { status: 502 });
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const result = await saveErpProposals(await request.json().catch(() => null), session.user.id);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
