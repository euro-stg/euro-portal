import { MASTER_ITEM_GROUPS } from "@/lib/master-item-sync";

// Filter daftar Master Item — dipakai bersama GET /api/master-item (tabel) dan
// /api/master-item/export (CSV) supaya isi export selalu sama dengan yang tampil di tabel.
// Query: q (nama/SKU), group, status (ACTIVE | DISCONTINUED), company, business.
export function buildMasterItemWhere(sp: URLSearchParams) {
  const q = sp.get("q")?.trim() ?? "";
  const group = sp.get("group") ?? "";
  const status = sp.get("status") ?? "";
  const company = sp.get("company") ?? "";
  const business = sp.get("business") ?? "";
  return {
    ...(q ? { OR: [{ itemName: { contains: q, mode: "insensitive" as const } }, { itemCode: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...((MASTER_ITEM_GROUPS as readonly string[]).includes(group) ? { itemGroup: group } : {}),
    ...(status === "ACTIVE" || status === "DISCONTINUED" ? { status } : {}),
    ...(company ? { company } : {}),
    ...(business ? { business } : {}),
  };
}
