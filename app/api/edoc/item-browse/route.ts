import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { ErpError } from "@/lib/erp";
import db from "@/lib/db/db";
import { buildMasterItemWhere } from "@/lib/master-item-query";
import { itemScopeWhere, resolveItemScope } from "@/lib/item-browse-scope";
import { buildLivePromos, checkErpStatus } from "@/lib/im-erp-live";

export const maxDuration = 120;
const PAGE_SIZE = 30;

// Item / Promo Browser live dari ERP (2026-11-17) — lihat app/lib/im-erp-live.ts. Baca saja.
//   GET ?list=1&q=&page= → daftar Master Item portal (30 per halaman), dibatasi grup & BU user
//   GET ?status=1[&force=1]      → status koneksi ERP (OK / ERROR / NOT_CONFIGURED)
//   GET ?itemCode=[&refresh=1]   → promo aktif item itu dari ERP (cache 5 menit)
// Login saja yang dicek (sama dengan Item Browser lama) — tidak ada data yang ditulis.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const sp = new URL(request.url).searchParams;
    if (sp.get("status") === "1") return NextResponse.json(await checkErpStatus(sp.get("force") === "1"));
    const itemCode = sp.get("itemCode")?.trim();
    const scope = await itemScopeWhere(session.user.id);
    if (!itemCode) {
      // Cermin Master Item portal, dibatasi grup item & business unit user (lib/item-browse-scope.ts).
      const where = { AND: [buildMasterItemWhere(sp), scope] };
      const page = Math.max(1, Number(sp.get("page")) || 1);
      const [data, total, active, discontinued, sc] = await Promise.all([
        db.masterItem.findMany({
          where, orderBy: [{ itemName: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
          select: { itemCode: true, itemName: true, itemGroup: true, company: true, business: true, status: true, standardPrice: true },
        }),
        db.masterItem.count({ where }),
        db.masterItem.count({ where: { AND: [scope, { status: "ACTIVE" }] } }),
        db.masterItem.count({ where: { AND: [scope, { status: "DISCONTINUED" }] } }),
        resolveItemScope(session.user.id),
      ]);
      // `scope` = bahan tombol info di UI (kenapa daftar ini dibatasi); counts = isi cakupan, tanpa pencarian.
      return NextResponse.json({ data, total, page, pageSize: PAGE_SIZE, scope: { ...sc, counts: { active, discontinued } } });
    }
    if (!(await db.masterItem.count({ where: { AND: [{ itemCode }, scope] } }))) return NextResponse.json({ message: "Item di luar cakupan Anda" }, { status: 403 });
    const result = await buildLivePromos(itemCode, sp.get("refresh") === "1");
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status ?? 400 });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ErpError) return NextResponse.json({ message: `ERP: ${err.message}` }, { status: 502 });
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
