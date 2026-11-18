import { erpListAll } from "@/lib/erp";

// Helper baca struktur promo ERP (dipakai Item / Promo Browser live, app/lib/im-erp-live.ts).
// Fitur Sync Item ke IM lama sudah dihapus (2026-11-18). Struktur ERP (diriset 2026-11-03):
//   - Pricing Rule (apply_on "Item Code", child "Pricing Rule Item Code") = PROMO-nya: diskon %,
//     potongan nominal, atau harga khusus; dibatasi territory / customer group / customer /
//     min qty. Nomor IM ada di JUDUL rule ("DEI - IM 441_2025 - Promo 40% ...") dan/atau nama
//     Price List-nya ("Promo ... - IM 441_2025 - DEI"). Satu IM bisa punya banyak rule (mis.
//     rule mingguan W14..W24 berdiskon sama → digabung jadi satu usulan).
//   - Item Price di Price List IM = harga dasar item di promo itu (sama dengan harga normal)
//     → mengisi Harga Normal usulan & dasar MENGHITUNG harga promo (disetujui user 2026-11-03;
//     tetap bisa diedit saat review).
// Nomor IM ERP "IM 486_2026" ↔ Document Number portal "486/Euromedica/IM/BUS/VII/2026"
// (nomor urut + tahun). Format lama tanpa tahun ("IM 274") dicocokkan by nomor urut saja,
// HANYA kalau tepat satu IM aktif portal bernomor itu.

export type ErpRule = {
  name: string; title: string | null; for_price_list: string | null; rate_or_discount: string | null;
  discount_percentage: number | null; discount_amount: number | null; rate: number | null;
  valid_from: string | null; valid_upto: string | null; applicable_for: string | null;
  territory: string | null; multiple_territories: string | null; customer_group: string | null; customer: string | null;
  min_qty: number | null;
};
export type ErpPrice = { price_list: string; price_list_rate: number; valid_from: string | null; valid_upto: string | null };

type ImKey = { seq: number; year: number | null };

/** "IM 441_2025" / "IM 274" di nama/judul ERP. */
export function parseErpImKey(s: string | null | undefined): ImKey | null {
  const m = s?.match(/\bIM\s*0*(\d+)(?:_(\d{4}))?\b/i);
  return m ? { seq: Number(m[1]), year: m[2] ? Number(m[2]) : null } : null;
}
/** "486/Euromedica/IM/BUS/VII/2026" → { seq: 486, year: 2026 }. */
export function parsePortalImKey(documentNumber: string | null): ImKey | null {
  const seq = documentNumber?.match(/^\s*0*(\d+)/)?.[1];
  if (!seq) return null;
  const year = documentNumber!.match(/(\d{4})\s*$/)?.[1];
  return { seq: Number(seq), year: year ? Number(year) : null };
}

export const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // WIB
export const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "…");
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/** Territory rule (bisa banyak: multiple_territories JSON + territory tunggal), tanpa duplikat. */
export function territoriesOf(r: ErpRule): string[] {
  let t: string[] = [];
  try { t = r.multiple_territories ? JSON.parse(r.multiple_territories) : []; } catch { /* abaikan format aneh */ }
  if (r.territory) t.push(r.territory);
  return [...new Set(t.filter(Boolean))].sort();
}
/** Pembatasan langsung di rule selain territory (kasus langka: Customer / Customer Group). */
export function eligibleOf(r: ErpRule): string | null {
  if (r.applicable_for === "Customer" && r.customer) return `Customer: ${r.customer}`;
  if (r.applicable_for === "Customer Group" && r.customer_group) return `Customer Group: ${r.customer_group}`;
  return null;
}

type ErpPriceListFlags = Record<string, number | string | null> & { name: string };

// Segmen klien di Price List ERP (field custom "Client Type" + for New/Existing Client).
const PL_CLIENT_TYPES: [string, string][] = [["new_joiner", "New Joiner"], ["trial", "Trial"], ["new", "New"], ["win_back", "Win Back"], ["active", "Active"],
  ["substatus_winback", "Win Back"], ["substatus_loyal", "Loyal"], ["leavers", "Leavers"], ["trial_leavers", "Trial Leavers"], ["loyal", "Loyal"]];

/**
 * Eligible Client dari Price List rule (2026-11-17, diriset ke ERP): = Client Type di Price List
 * (New Joiner, Trial, Leavers, …). Territory TIDAK ada di Price List — ada di Pricing Rule & dipisah
 * ke kolom Ketentuan. Best effort: akun ERP tak boleh baca → kosong.
 */
export async function loadPriceListAudience(lists: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const real = lists.filter((l) => l && l !== "Standard Selling");
  if (!real.length) return out;
  try {
    // Dipecah per 15 nama — filter `in` dengan puluhan nama price list membuat URL terlalu panjang.
    const chunks: string[][] = [];
    for (let i = 0; i < real.length; i += 15) chunks.push(real.slice(i, i + 15));
    const results = await Promise.all(chunks.map((c) => erpListAll<ErpPriceListFlags>("Price List", {
      fields: ["name", ...PL_CLIENT_TYPES.map(([f]) => f)], filters: [["name", "in", c]], pageSize: 500,
    })));
    for (const r of results.flat()) out.set(r.name, [...new Set(PL_CLIENT_TYPES.filter(([f]) => r[f]).map(([, l]) => l))]);
  } catch { /* akses ERP terbatas — abaikan, eligible client tetap dari rule */ }
  return out;
}

export function promoOf(r: ErpRule, baseRate: number | null) {
  const pct = r.discount_percentage ?? 0, amt = r.discount_amount ?? 0, rate = r.rate ?? 0;
  if (r.rate_or_discount === "Discount Percentage" && pct > 0)
    return { promoType: `Diskon ${pct}%`, discountPercent: pct, promoPrice: baseRate != null ? Math.round(baseRate * (1 - pct / 100)) : null };
  if (r.rate_or_discount === "Discount Amount" && amt > 0)
    return { promoType: `Potongan ${rupiah(amt)}`, discountPercent: null, promoPrice: baseRate != null ? Math.max(0, baseRate - amt) : null };
  if (r.rate_or_discount === "Rate" && rate > 0) return { promoType: "Harga Khusus", discountPercent: null, promoPrice: rate };
  // Rule tanpa nilai diskon (mis. B2G3 / bundling) — detailnya hanya ada di judul rule.
  return { promoType: "Lainnya (lihat detail)", discountPercent: null, promoPrice: null };
}
