import db from "@/lib/db/db";
import { erpListAll, getErpConfig } from "@/lib/erp";

// Sync Master Item dari ERP (2026-10-28). Sync pertama / "penuh" mengambil semua item di grup
// cakupan; sync berikutnya hanya item yang berubah sejak sync terakhir (kursor = "modified"
// ERP), dari grup MANA PUN — supaya item yang dipindah keluar dari cakupan ikut terdeteksi.

export const MASTER_ITEM_GROUPS = [
  "Treatment", "Treatment Product 01", "Treatment Product 02",
  "Retail Product 01", "Retail Product 02", "Discontinued",
] as const;
const DISCONTINUED_GROUP = "Discontinued";
export const CURSOR_KEY = "erp.itemSync.cursor";

// Pengecualian (2026-10-30) — company/business yang sudah tidak dipakai (mis. DMI, SKIN+ MBS)
// tidak masuk Master Item supaya tidak rancu dengan item aktif bernama sama. Diatur di
// Pengaturan → ERP; isian awal dibuat migrasi 20261030100000_master_item_exclusions.
export const EXCLUDE_KEYS = {
  companies: "erp.exclude.companies",   // JSON string[]
  businesses: "erp.exclude.businesses", // JSON string[]
  noCompany: "erp.exclude.noCompany",   // "true" | "false"
} as const;
export type MasterItemExclusions = { companies: string[]; businesses: string[]; noCompany: boolean };

export async function getMasterItemExclusions(): Promise<MasterItemExclusions> {
  const rows = await db.systemConfig.findMany({ where: { key: { in: Object.values(EXCLUDE_KEYS) } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const list = (v: string | undefined) => { try { const a = JSON.parse(v ?? "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
  return { companies: list(map[EXCLUDE_KEYS.companies]), businesses: list(map[EXCLUDE_KEYS.businesses]), noCompany: map[EXCLUDE_KEYS.noCompany] === "true" };
}

const isExcluded = (ex: MasterItemExclusions, company: string | null, business: string | null) =>
  (!company && ex.noCompany) || (!!company && ex.companies.includes(company)) || (!!business && ex.businesses.includes(business));

/** Hapus item yang terkena pengecualian dari Master Item. Return jumlah yang dihapus. */
export async function purgeExcludedMasterItems(ex?: MasterItemExclusions): Promise<number> {
  const e = ex ?? (await getMasterItemExclusions());
  const OR = [
    ...(e.companies.length ? [{ company: { in: e.companies } }] : []),
    ...(e.businesses.length ? [{ business: { in: e.businesses } }] : []),
    ...(e.noCompany ? [{ company: null }] : []),
  ];
  if (!OR.length) return 0;
  const { count } = await db.masterItem.deleteMany({ where: { OR } });
  return count;
}
const STALE_RUN_MS = 30 * 60_000; // sync "running" lebih lama dari ini dianggap macet

/** Nama dinormalisasi untuk pencocokan by nama (huruf kecil, spasi tunggal). */
export const normalizeItemName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

type ErpItem = {
  item_code: string; item_name: string; item_group: string; stock_uom: string | null; disabled: number; modified: string;
  company: string | null; business: string | null; treatment_type: string | null; qty_package: number | null;
  description: string | null; is_sales_item: number;
};
type ErpItemPrice = { item_code: string; company: string | null; price_list_rate: number; valid_from: string | null; valid_upto: string | null };

const STANDARD_PRICE_LIST = "Standard Selling";

export type SyncResult = { processed: number; created: number; updated: number; discontinued: number; excluded: number; pricesUpdated: number; full: boolean };

export async function syncMasterItems(trigger: "manual" | "scheduled", opts: { full?: boolean } = {}): Promise<SyncResult> {
  const running = await db.syncLog.findFirst({
    where: { type: "master_item", status: "running", startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
    select: { id: true },
  });
  if (running) throw new Error("Sync Master Item sedang berjalan, coba lagi beberapa saat lagi");
  if (!(await getErpConfig())) throw new Error("Koneksi ERP belum dikonfigurasi (Pengaturan → ERP)");

  const log = await db.syncLog.create({ data: { type: "master_item", trigger, status: "running" } });
  try {
    const cursorRow = await db.systemConfig.findUnique({ where: { key: CURSOR_KEY } });
    const full = !!opts.full || !cursorRow?.value;

    const fields = [
      "item_code", "item_name", "item_group", "stock_uom", "disabled", "modified",
      "company", "business", "treatment_type", "qty_package", "description", "is_sales_item",
    ];
    const items = await erpListAll<ErpItem>("Item", {
      fields,
      filters: full ? [["item_group", "in", [...MASTER_ITEM_GROUPS]]] : [["modified", ">=", cursorRow!.value]],
    });

    const existing = new Map(
      (await db.masterItem.findMany({
        select: {
          itemCode: true, itemName: true, itemGroup: true, stockUom: true, erpDisabled: true, status: true,
          company: true, business: true, treatmentType: true, qtyPackage: true, description: true, isSalesItem: true,
        },
      }))
        .map((m) => [m.itemCode, m]),
    );

    const exclusions = await getMasterItemExclusions();
    let created = 0, updated = 0, discontinued = 0, excluded = 0;
    let maxModified = cursorRow?.value ?? "";
    const seen = new Set<string>();

    for (const it of items) {
      if (it.modified > maxModified) maxModified = it.modified;
      const inScope = (MASTER_ITEM_GROUPS as readonly string[]).includes(it.item_group);
      const prev = existing.get(it.item_code);
      if (isExcluded(exclusions, it.company || null, it.business || null)) {
        // Company/business dikecualikan → tidak masuk master; kalau sudah ada, dihapus.
        if (prev) { await db.masterItem.delete({ where: { itemCode: it.item_code } }); excluded++; }
        continue;
      }
      if (!inScope && !prev) continue; // item di luar cakupan yang belum pernah masuk master
      seen.add(it.item_code);

      const status = !inScope || it.item_group === DISCONTINUED_GROUP || it.disabled ? "DISCONTINUED" : "ACTIVE";
      const data = {
        itemName: it.item_name, nameKey: normalizeItemName(it.item_name), itemGroup: it.item_group,
        stockUom: it.stock_uom, erpDisabled: !!it.disabled, status, erpModified: it.modified, syncedAt: new Date(),
        company: it.company || null, business: it.business || null, treatmentType: it.treatment_type || null,
        qtyPackage: it.qty_package ?? null, description: it.description || null, isSalesItem: !!it.is_sales_item,
      };

      if (!prev) {
        await db.masterItem.create({ data: { itemCode: it.item_code, ...data } });
        created++;
        continue;
      }
      const changed = prev.itemName !== data.itemName || prev.itemGroup !== data.itemGroup || prev.stockUom !== data.stockUom
        || prev.erpDisabled !== data.erpDisabled || prev.status !== status || prev.company !== data.company
        || prev.business !== data.business || prev.treatmentType !== data.treatmentType || prev.qtyPackage !== data.qtyPackage
        || prev.description !== data.description || prev.isSalesItem !== data.isSalesItem;
      await db.masterItem.update({ where: { itemCode: it.item_code }, data });
      if (changed) updated++;
      if (prev.status !== "DISCONTINUED" && status === "DISCONTINUED") discontinued++;
    }

    // Sync penuh: item master yang sudah tidak ada di cakupan ERP → DISCONTINUED.
    if (full) {
      const gone = [...existing.values()].filter((m) => !seen.has(m.itemCode) && m.status !== "DISCONTINUED").map((m) => m.itemCode);
      if (gone.length) {
        await db.masterItem.updateMany({ where: { itemCode: { in: gone } }, data: { status: "DISCONTINUED", syncedAt: new Date() } });
        discontinued += gone.length; updated += gone.length;
      }
    }

    // Jaga-jaga: item lama yang terkena pengecualian tapi tidak ikut terambil sync bertahap.
    excluded += await purgeExcludedMasterItems(exclusions);
    const pricesUpdated = await refreshStandardPrices();

    if (maxModified) {
      await db.systemConfig.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: maxModified }, update: { value: maxModified } });
    }
    const result = { processed: items.length, created, updated, discontinued, excluded, pricesUpdated, full };
    await db.syncLog.update({ where: { id: log.id }, data: { status: "success", processed: items.length, created, updated, finishedAt: new Date() } });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.syncLog.update({ where: { id: log.id }, data: { status: "error", error: msg, finishedAt: new Date() } });
    throw err;
  }
}

/**
 * Harga standar per item = Item Price TERBARU di Price List "Standard Selling" untuk company
 * item itu (2026-10-30): baris dengan tanggal mulai paling baru yang sudah dimulai (bukan harga
 * masa depan), walau periodenya sudah lewat — di ERP harga standar dicatat per tahun & sering
 * belum diperpanjang; tampilan menandai yang sudah lewat sebagai "berakhir". Diambil ulang
 * SETIAP sync karena perubahan harga di ERP tidak mengubah "modified" Item. Return jumlah item
 * yang harganya berubah.
 */
async function refreshStandardPrices(): Promise<number> {
  const prices = await erpListAll<ErpItemPrice>("Item Price", {
    fields: ["item_code", "company", "price_list_rate", "valid_from", "valid_upto"],
    filters: [["price_list", "=", STANDARD_PRICE_LIST]],
    orderBy: "valid_from asc",
  });
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  // Per (item, company): baris terbaru yang sudah dimulai (valid_from <= hari ini).
  const current = new Map<string, ErpItemPrice>();
  for (const p of prices) {
    if (p.valid_from && p.valid_from > today) continue;
    const key = `${p.item_code}|${p.company ?? ""}`;
    const prev = current.get(key);
    if (!prev || (p.valid_from ?? "") >= (prev.valid_from ?? "")) current.set(key, p);
  }

  const items = await db.masterItem.findMany({
    select: { itemCode: true, company: true, standardPrice: true, standardPriceValidFrom: true, standardPriceValidUpto: true },
  });
  let changed = 0;
  for (const m of items) {
    const p = current.get(`${m.itemCode}|${m.company ?? ""}`);
    const next = { standardPrice: p?.price_list_rate ?? null, standardPriceValidFrom: p?.valid_from ?? null, standardPriceValidUpto: p?.valid_upto ?? null };
    if (m.standardPrice === next.standardPrice && m.standardPriceValidFrom === next.standardPriceValidFrom && m.standardPriceValidUpto === next.standardPriceValidUpto) continue;
    await db.masterItem.update({ where: { itemCode: m.itemCode }, data: next });
    changed++;
  }
  return changed;
}

/** Waktu & hasil sync terakhir (untuk ditampilkan di halaman). */
export async function getLastMasterItemSync() {
  return db.syncLog.findFirst({ where: { type: "master_item" }, orderBy: { startedAt: "desc" } });
}

// ── Jadwal otomatis: sekali sehari pukul 01:30 WIB ────────────────────────────────────────
const AUTO_DATE_KEY = "erp.itemSync.lastAutoDate";
const AUTO_HOUR_WIB = 1, AUTO_MINUTE_WIB = 30;
const globalForSched = globalThis as unknown as { __masterItemSchedStarted?: boolean };

export function startMasterItemScheduler() {
  if (globalForSched.__masterItemSchedStarted) return;
  if ((process.env.ENV_MODE ?? "PRODUCTION") === "REPLICA") return;
  globalForSched.__masterItemSchedStarted = true;

  const tick = async () => {
    try {
      const wib = new Date(Date.now() + 7 * 3600_000);
      const today = wib.toISOString().slice(0, 10);
      const due = wib.getUTCHours() > AUTO_HOUR_WIB || (wib.getUTCHours() === AUTO_HOUR_WIB && wib.getUTCMinutes() >= AUTO_MINUTE_WIB);
      if (!due) return;
      const last = await db.systemConfig.findUnique({ where: { key: AUTO_DATE_KEY } });
      if (last?.value === today) return;
      if (!(await getErpConfig())) return;
      // Tandai dulu supaya tidak dobel walau sync gagal (dicoba lagi besok / manual).
      await db.systemConfig.upsert({ where: { key: AUTO_DATE_KEY }, create: { key: AUTO_DATE_KEY, value: today }, update: { value: today } });
      const r = await syncMasterItems("scheduled");
      console.log(`[master-item] sync terjadwal selesai — diproses ${r.processed}, baru ${r.created}, berubah ${r.updated}, harga berubah ${r.pricesUpdated}`);
    } catch (err) {
      console.error("[master-item] sync terjadwal gagal", err);
    }
  };
  setInterval(() => void tick(), 5 * 60_000);
  setTimeout(() => void tick(), 60_000);
  console.log("[master-item] jadwal sync Master Item aktif (01:30 WIB)");
}
