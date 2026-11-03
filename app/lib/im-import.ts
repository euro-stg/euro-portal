import db from "@/lib/db/db";
import type { ImProductInput } from "@/lib/edoc";

// Import item IM berbasis SKU (2026-11-02, menggantikan pencocokan by nama 2026-10-30). User
// WAJIB mengisi kolom SKU (= item_code ERP) di Excel. Alur: Excel → pratinjau/konfirmasi (tidak
// menyimpan apa pun) → simpan. Aturan per baris:
//   - SKU kosong / tidak ada di Master Item / Discontinued  → bermasalah, import DIBLOKIR
//   - nama item disamakan dengan nama resmi Master Item (ditandai kalau berbeda dari Excel)
//   - satu baris = satu SKU (item yang berlaku di beberapa company ditulis beberapa baris)
// Dipakai import di detail IM, upload IM baru, dan Cocokkan & Import Item.

type MasterRef = { itemCode: string; itemName: string; company: string | null; business: string | null; itemGroup: string; status: string; standardPrice: number | null };

export type PreviewRow = {
  index: number;
  product: ImProductInput; // itemName SUDAH disamakan dengan Master Item kalau SKU valid
  excelName: string; // nama asli di Excel
  sku: string | null;
  master: MasterRef | null;
  error: string | null; // alasan baris diblokir
  nameChanged: boolean;
};
export type ImportPreview = {
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number; renamed: number };
};

const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/** Muat Master Item untuk sekumpulan SKU (pencarian tidak peka huruf besar/kecil). */
async function loadMasterBySku(skus: string[]) {
  const wanted = [...new Set(skus.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (wanted.length === 0) return new Map<string, MasterRef>();
  const rows = await db.masterItem.findMany({
    where: { OR: wanted.map((s) => ({ itemCode: { equals: s, mode: "insensitive" as const } })) },
    select: { itemCode: true, itemName: true, company: true, business: true, itemGroup: true, status: true, standardPrice: true },
  });
  return new Map(rows.map((r) => [r.itemCode.toUpperCase(), r]));
}

function checkRow(p: ImProductInput, master: Map<string, MasterRef>): { sku: string | null; master: MasterRef | null; error: string | null } {
  const sku = p.sku?.trim() || null;
  if (!sku) return { sku, master: null, error: "SKU kosong" };
  const m = master.get(sku.toUpperCase()) ?? null;
  if (!m) return { sku, master: null, error: `SKU ${sku} tidak ada di Master Item` };
  if (m.status !== "ACTIVE") return { sku, master: m, error: `SKU ${m.itemCode} sudah Discontinued` };
  return { sku: m.itemCode, master: m, error: null };
}

export async function buildImportPreview(products: ImProductInput[]): Promise<ImportPreview> {
  const master = await loadMasterBySku(products.map((p) => p.sku ?? ""));
  const rows = products.map((p, index): PreviewRow => {
    const c = checkRow(p, master);
    const officialName = c.master && !c.error ? c.master.itemName : p.itemName;
    return {
      index, excelName: p.itemName, sku: c.sku, master: c.master, error: c.error,
      nameChanged: !c.error && !!c.master && !sameName(c.master.itemName, p.itemName),
      product: { ...p, itemName: officialName, sku: c.sku },
    };
  });
  const invalid = rows.filter((r) => r.error).length;
  return { rows, summary: { total: rows.length, valid: rows.length - invalid, invalid, renamed: rows.filter((r) => r.nameChanged).length } };
}

// ── Simpan ────────────────────────────────────────────────────────────────────────────────
export type ReviewedRow = { product: ImProductInput; skus: { company: string; itemCode: string }[] };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** Bersihkan field baris dari client (JSON) — hanya field EDocImProduct yang dikenal. */
function sanitizeProduct(p: Record<string, unknown>): ImProductInput {
  const extra = p.extra && typeof p.extra === "object" && !Array.isArray(p.extra) ? (p.extra as Record<string, unknown>) : null;
  return {
    itemName: str(p.itemName) ?? "", sku: str(p.sku), category: str(p.category), discountClass: str(p.discountClass),
    normalPrice: num(p.normalPrice), promoType: str(p.promoType), promoDetail: str(p.promoDetail), promoPrice: num(p.promoPrice),
    discountPercent: num(p.discountPercent), qty: num(p.qty) == null ? null : Math.round(num(p.qty)!), imNumber: str(p.imNumber),
    imSubject: str(p.imSubject), validity: str(p.validity), eligibleClient: str(p.eligibleClient), keyConditions: str(p.keyConditions),
    extra,
  };
}

/**
 * Validasi ulang baris dari client sebelum disimpan — input `[{ product }]` (field `product.sku`
 * wajib). Aturan sama dengan pratinjau; nama & company SELALU diambil dari Master Item di server
 * (isian client untuk keduanya diabaikan). Return pesan error (untuk 400) atau baris siap simpan.
 */
export async function validateReviewedRows(input: unknown): Promise<{ error: string } | { rows: ReviewedRow[] }> {
  if (!Array.isArray(input) || input.length === 0) return { error: "Tidak ada baris item untuk disimpan" };
  const products = input.map((raw) => sanitizeProduct(((raw ?? {}) as { product?: Record<string, unknown> }).product ?? {}));
  const master = await loadMasterBySku(products.map((p) => p.sku ?? ""));
  const rows: ReviewedRow[] = [];
  for (const [i, p] of products.entries()) {
    const c = checkRow(p, master);
    if (c.error || !c.master) return { error: `Baris ${i + 1}${p.itemName ? ` (${p.itemName})` : ""}: ${c.error ?? "SKU tidak valid"}` };
    if (!c.master.company) return { error: `Baris ${i + 1}: SKU ${c.master.itemCode} tidak punya company di Master Item` };
    rows.push({
      product: { ...p, itemName: c.master.itemName, sku: c.master.itemCode },
      skus: [{ company: c.master.company, itemCode: c.master.itemCode }],
    });
  }
  return { rows };
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Buat baris item IM + mapping SKU-nya (di dalam transaksi pemanggil). */
export function createImProducts(tx: Tx, fileId: string, rows: ReviewedRow[], userId: string) {
  return Promise.all(rows.map(({ product: p, skus }) => tx.eDocImProduct.create({
    data: {
      fileId, itemName: p.itemName, sku: skus.map((s) => s.itemCode).join(", "), category: p.category, discountClass: p.discountClass,
      normalPrice: p.normalPrice, promoType: p.promoType, promoDetail: p.promoDetail, promoPrice: p.promoPrice,
      discountPercent: p.discountPercent, qty: p.qty, imNumber: p.imNumber, imSubject: p.imSubject, validity: p.validity,
      eligibleClient: p.eligibleClient, keyConditions: p.keyConditions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: (p.extra ?? undefined) as any,
      importedBy: userId,
      skus: { create: skus.map((s) => ({ company: s.company, itemCode: s.itemCode, mappedBy: userId })) },
    },
  })));
}
