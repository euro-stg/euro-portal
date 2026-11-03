import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageImItems, listRemovals, removeDiscontinued } from "@/lib/im-check";

// Riwayat item IM yang dikeluarkan (2026-11-02).
//   GET  ?page=                      → daftar riwayat (terbaru dulu)
//   POST { productIds: string[] }    → keluarkan item yang SEMUA SKU-nya Discontinued
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
    return NextResponse.json(await listRemovals(page));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { productIds?: unknown } | null;
    const result = await removeDiscontinued(body?.productIds, session.user.id);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
