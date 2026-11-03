import db from "@/lib/db/db";
import { extractDocumentNumberFromFilename, type ImProductInput } from "@/lib/edoc";
import { buildImportPreview, type ImportPreview } from "@/lib/im-import";

// "Cocokkan & Import Item" dengan validasi SKU (2026-10-30; berbasis kolom SKU sejak 2026-11-02).
// Dulu satu request langsung menulis semuanya; sekarang dipecah: PRATINJAU (tanpa menulis apa
// pun) → user konfirmasi per IM → IMPORT (perbaikan nomor dokumen + simpan item). Logika fase lama (2026-09-25/30)
// dipertahankan apa adanya, hanya dipisah jadi "rencana" (baca saja) & "terapkan".

type DocFix = { fileId: string; title: string; documentNumber: string; oldDocumentNumber?: string };

/**
 * Rencana perbaikan Document Number file IM — TANPA menulis:
 *  - backfill: documentNumber kosong → diisi dari title (nama file asli)
 *  - repair: format lama underscore → slash, HANYA kalau title diawali nomor tersimpan + spasi
 *    (tanda nomor itu hasil auto-generate lama, bukan ketikan manual user)
 */
export async function planDocumentNumberFixes(): Promise<{ backfills: DocFix[]; repairs: DocFix[] }> {
  const candidates = await db.eDocFile.findMany({
    where: { deletedAt: null, documentNumber: null, category: { code: "IM" } }, select: { id: true, title: true },
  });
  const usedNumbers = new Set(
    (await db.eDocFile.findMany({ where: { deletedAt: null, documentNumber: { not: null } }, select: { documentNumber: true } }))
      .map((f) => f.documentNumber as string),
  );
  const backfills: DocFix[] = [];
  for (const c of candidates) {
    const detected = extractDocumentNumberFromFilename(c.title);
    if (!detected || usedNumbers.has(detected)) continue;
    usedNumbers.add(detected);
    backfills.push({ fileId: c.id, title: c.title, documentNumber: detected });
  }
  const stale = await db.eDocFile.findMany({
    where: { deletedAt: null, documentNumber: { not: null, contains: "_" }, category: { code: "IM" } },
    select: { id: true, title: true, documentNumber: true },
  });
  const repairs: DocFix[] = [];
  for (const c of stale) {
    const old = c.documentNumber as string;
    if (!c.title.startsWith(`${old} `)) continue;
    const corrected = extractDocumentNumberFromFilename(c.title);
    if (!corrected || corrected === old || usedNumbers.has(corrected)) continue;
    usedNumbers.delete(old); usedNumbers.add(corrected);
    repairs.push({ fileId: c.id, title: c.title, oldDocumentNumber: old, documentNumber: corrected });
  }
  return { backfills, repairs };
}

/** Terapkan fase lama: flag requiresItemImport file bulk IM + perbaikan Document Number. */
export async function applyDocumentNumberFixes() {
  const flag = await db.eDocFile.updateMany({
    where: { deletedAt: null, bulkImported: true, requiresItemImport: false, category: { code: "IM" } },
    data: { requiresItemImport: true },
  });
  const plan = await planDocumentNumberFixes();
  for (const f of [...plan.backfills, ...plan.repairs]) {
    await db.eDocFile.update({ where: { id: f.fileId }, data: { documentNumber: f.documentNumber } });
  }
  return { itemImportFlagBackfilled: flag.count, backfilled: plan.backfills, repaired: plan.repairs };
}

export type BulkPreviewGroup = {
  fileId: string; title: string; documentNumber: string; businessUnitCodes: string[]; status: string;
  existingItems: number; existingMapped: number; // item yang sudah ada & yang sudah punya mapping SKU
  preview: ImportPreview;
};

/** Pratinjau: kelompokkan baris per No. IM, cocokkan ke file IM, validasi SKU tiap baris. */
export async function buildBulkPreview(products: ImProductInput[]) {
  const plan = await planDocumentNumberFixes();
  const planned = new Map([...plan.backfills, ...plan.repairs].map((f) => [f.fileId, f.documentNumber]));

  const files = await db.eDocFile.findMany({
    where: { deletedAt: null, category: { code: "IM" }, OR: [{ documentNumber: { not: null } }, { id: { in: [...planned.keys()] } }] },
    select: { id: true, title: true, documentNumber: true, businessUnitCodes: true, status: true },
  });
  // Nomor efektif = hasil perbaikan yang direncanakan (kalau ada), selain itu nomor tersimpan.
  const byNumber = new Map<string, (typeof files)[number] & { effective: string }>();
  for (const f of files) {
    const effective = planned.get(f.id) ?? f.documentNumber;
    if (effective) byNumber.set(effective.toLowerCase(), { ...f, effective });
  }

  const groups = new Map<string, { original: string; rows: ImProductInput[] }>();
  let skippedNoImNumber = 0;
  for (const p of products) {
    const raw = p.imNumber?.trim();
    if (!raw) { skippedNoImNumber++; continue; }
    const g = groups.get(raw.toLowerCase());
    if (g) g.rows.push(p); else groups.set(raw.toLowerCase(), { original: raw, rows: [p] });
  }

  const matched: BulkPreviewGroup[] = [];
  const unmatched: { imNumber: string; rowCount: number }[] = [];
  for (const [key, { original, rows }] of groups) {
    const f = byNumber.get(key);
    if (!f) { unmatched.push({ imNumber: original, rowCount: rows.length }); continue; }
    matched.push({
      fileId: f.id, title: f.title, documentNumber: f.effective, businessUnitCodes: f.businessUnitCodes, status: f.status,
      existingItems: 0, existingMapped: 0,
      preview: await buildImportPreview(rows),
    });
  }
  if (matched.length) {
    const ids = matched.map((m) => m.fileId);
    const [all, mapped] = await Promise.all([
      db.eDocImProduct.groupBy({ by: ["fileId"], where: { fileId: { in: ids } }, _count: { _all: true } }),
      db.eDocImProduct.groupBy({ by: ["fileId"], where: { fileId: { in: ids }, skus: { some: {} } }, _count: { _all: true } }),
    ]);
    for (const m of matched) {
      m.existingItems = all.find((a) => a.fileId === m.fileId)?._count._all ?? 0;
      m.existingMapped = mapped.find((a) => a.fileId === m.fileId)?._count._all ?? 0;
    }
  }
  matched.sort((a, b) => a.documentNumber.localeCompare(b.documentNumber));
  return {
    groups: matched, unmatched, skippedNoImNumber,
    plannedFixes: { backfilled: plan.backfills.length, repaired: plan.repairs.length },
  };
}
