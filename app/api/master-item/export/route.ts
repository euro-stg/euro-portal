import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import db from "@/lib/db/db";
import { buildMasterItemWhere } from "@/lib/master-item-query";

// Export Master Item ke CSV (2026-11-11) — mengikuti filter tabel (buildMasterItemWhere), semua
// halaman. Khusus yang punya menu Master Item (beda dengan GET /api/master-item yang cukup login
// karena dipakai E Document). UTF-8 + BOM supaya nama item ber-aksen terbaca benar di Excel.
type Row = Awaited<ReturnType<typeof db.masterItem.findMany>>[number];
const COLUMNS: [string, (r: Row) => string | number | null][] = [
  ["SKU", (r) => r.itemCode],
  ["Nama Item", (r) => r.itemName],
  ["Grup", (r) => r.itemGroup],
  ["Company", (r) => r.company],
  ["Business", (r) => r.business],
  ["Jenis Treatment", (r) => r.treatmentType],
  ["Satuan", (r) => r.stockUom],
  ["Qty Paket", (r) => r.qtyPackage],
  ["Item Penjualan", (r) => (r.isSalesItem ? "Ya" : "Tidak")],
  ["Harga Standar", (r) => r.standardPrice],
  ["Harga Berlaku Dari", (r) => r.standardPriceValidFrom],
  ["Harga Berlaku Sampai", (r) => r.standardPriceValidUpto],
  ["Status", (r) => (r.status === "ACTIVE" ? "Aktif" : "Discontinued")],
  ["Disabled di ERP", (r) => (r.erpDisabled ? "Ya" : "Tidak")],
  ["Deskripsi", (r) => plainText(r.description)],
  ["Diubah di ERP", (r) => r.erpModified?.slice(0, 19) ?? null],
  ["Terakhir Sync", (r) => new Date(r.syncedAt.getTime() + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ")],
];

// Deskripsi dari ERP bisa berisi HTML (mis. "<div>…</div>") — jadikan teks biasa.
const plainText = (html: string | null) =>
  html == null ? null : html.replace(/<br\s*\/?>|<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n").trim();

// Teks diawali = + - @ bisa dijalankan Excel sebagai formula (CSV injection) — beri awalan '.
const cell = (v: string | number | null) => {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.masterItem]))) return forbidden();

    const where = buildMasterItemWhere(new URL(request.url).searchParams);
    const rows = await db.masterItem.findMany({ where, orderBy: [{ status: "asc" }, { itemName: "asc" }] });
    const lines = [COLUMNS.map(([h]) => h).join(","), ...rows.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(","))];
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

    return new Response("﻿" + lines.join("\r\n") + "\r\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="master-item-${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
