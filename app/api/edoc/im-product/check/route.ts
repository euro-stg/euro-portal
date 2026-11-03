import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageImItems, runImCheck } from "@/lib/im-check";

// Cek Item vs Master Item (2026-11-02) — ringkasan + daftar Discontinued/Sebagian di IM aktif.
// ?summary=1 → ringkasan saja (dipakai tombol di Item Browser). Lihat app/lib/im-check.ts.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await canManageImItems(session.user.id))) return NextResponse.json({ message: "Khusus superadmin & Document Approver" }, { status: 403 });
    const result = await runImCheck();
    if (new URL(request.url).searchParams.get("summary")) return NextResponse.json({ summary: result.summary });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
