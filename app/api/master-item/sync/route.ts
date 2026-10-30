import { NextResponse } from "next/server";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import { syncMasterItems } from "@/lib/master-item-sync";

// Sync Master Item manual dari ERP (2026-10-28). Body: { full?: boolean } — full = ambil ulang
// semua item cakupan (sekaligus menandai Discontinued item yang sudah tidak ada di ERP).
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) return unauthorized();
  if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.masterItem]))) return forbidden();
  const body = (await request.json().catch(() => ({}))) as { full?: boolean };
  try {
    const r = await syncMasterItems("manual", { full: !!body.full });
    return NextResponse.json({
      message: `Sync ${r.full ? "penuh " : ""}selesai — diproses ${r.processed}, baru ${r.created}, berubah ${r.updated}, discontinued ${r.discontinued}`,
      data: r,
    });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Sync gagal" }, { status: 502 });
  }
}
