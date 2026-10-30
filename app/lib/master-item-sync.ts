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
const CURSOR_KEY = "erp.itemSync.cursor";
const STALE_RUN_MS = 30 * 60_000; // sync "running" lebih lama dari ini dianggap macet

/** Nama dinormalisasi untuk pencocokan by nama (huruf kecil, spasi tunggal). */
export const normalizeItemName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

type ErpItem = { item_code: string; item_name: string; item_group: string; stock_uom: string | null; disabled: number; modified: string };

export type SyncResult = { processed: number; created: number; updated: number; discontinued: number; full: boolean };

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

    const fields = ["item_code", "item_name", "item_group", "stock_uom", "disabled", "modified"];
    const items = await erpListAll<ErpItem>("Item", {
      fields,
      filters: full ? [["item_group", "in", [...MASTER_ITEM_GROUPS]]] : [["modified", ">=", cursorRow!.value]],
    });

    const existing = new Map(
      (await db.masterItem.findMany({ select: { itemCode: true, itemName: true, itemGroup: true, stockUom: true, erpDisabled: true, status: true } }))
        .map((m) => [m.itemCode, m]),
    );

    let created = 0, updated = 0, discontinued = 0;
    let maxModified = cursorRow?.value ?? "";
    const seen = new Set<string>();

    for (const it of items) {
      if (it.modified > maxModified) maxModified = it.modified;
      const inScope = (MASTER_ITEM_GROUPS as readonly string[]).includes(it.item_group);
      const prev = existing.get(it.item_code);
      if (!inScope && !prev) continue; // item di luar cakupan yang belum pernah masuk master
      seen.add(it.item_code);

      const status = !inScope || it.item_group === DISCONTINUED_GROUP || it.disabled ? "DISCONTINUED" : "ACTIVE";
      const data = {
        itemName: it.item_name, nameKey: normalizeItemName(it.item_name), itemGroup: it.item_group,
        stockUom: it.stock_uom, erpDisabled: !!it.disabled, status, erpModified: it.modified, syncedAt: new Date(),
      };

      if (!prev) {
        await db.masterItem.create({ data: { itemCode: it.item_code, ...data } });
        created++;
        continue;
      }
      const changed = prev.itemName !== data.itemName || prev.itemGroup !== data.itemGroup || prev.stockUom !== data.stockUom
        || prev.erpDisabled !== data.erpDisabled || prev.status !== status;
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

    if (maxModified) {
      await db.systemConfig.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: maxModified }, update: { value: maxModified } });
    }
    const result = { processed: items.length, created, updated, discontinued, full };
    await db.syncLog.update({ where: { id: log.id }, data: { status: "success", processed: items.length, created, updated, finishedAt: new Date() } });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.syncLog.update({ where: { id: log.id }, data: { status: "error", error: msg, finishedAt: new Date() } });
    throw err;
  }
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
      console.log(`[master-item] sync terjadwal selesai — diproses ${r.processed}, baru ${r.created}, berubah ${r.updated}`);
    } catch (err) {
      console.error("[master-item] sync terjadwal gagal", err);
    }
  };
  setInterval(() => void tick(), 5 * 60_000);
  setTimeout(() => void tick(), 60_000);
  console.log("[master-item] jadwal sync Master Item aktif (01:30 WIB)");
}
