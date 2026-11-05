import db from "@/lib/db/db";
import { isEDocDocumentApprover, isSuperadmin, edocExpiryCutoff } from "@/lib/edoc";
import { evaluateMappedSkus, loadMasterIndex, matchKey, resolveRow, type MasterIndex, type SkuCandidate } from "@/lib/im-sku";

// Cek Item vs Master Item (2026-11-02, Tahap 3) — dibuka dari Item/Promo Browser. Cakupan =
// item di IM AKTIF (RELEASE, belum expired, bukan folder Obsolete — sama dengan cakupan
// Item Browser): IM yang sudah tidak berlaku tidak perlu dibersihkan/dipetakan.
//   - Discontinued : SEMUA SKU-nya Discontinued → rekomendasi dikeluarkan (user konfirmasi;
//                    disimpan ke EDocImProductRemoval, bisa "Kembalikan")
//   - Sebagian     : sebagian SKU Discontinued → informasi saja
//   - Belum dipetakan : item lama tanpa SKU → dipetakan manual, dibantu saran by nama
// Khusus superadmin & Document Approver (lintas semua IM, tidak terikat folder).

export async function canManageImItems(userId: string) {
  const [superadmin, approver] = await Promise.all([isSuperadmin(userId), isEDocDocumentApprover(userId)]);
  return superadmin || approver;
}

export const activeImFileWhere = () => ({
  deletedAt: null,
  status: "RELEASE" as const,
  category: { code: "IM" },
  folder: { type: { not: "OBSOLETE" as const } },
  OR: [{ endDate: null }, { endDate: { gt: edocExpiryCutoff() } }],
});

const fileSelect = { id: true, title: true, documentNumber: true, businessUnitCodes: true, endDate: true } as const;
const productSelect = {
  id: true, itemName: true, sku: true, promoType: true, promoPrice: true, imNumber: true,
  file: { select: fileSelect },
  skus: { select: { company: true, itemCode: true }, orderBy: { company: "asc" as const } },
};

export type CheckRow = {
  id: string; itemName: string; promoType: string | null; promoPrice: number | null;
  file: { id: string; title: string; documentNumber: string | null; businessUnitCodes: string[]; endDate: Date | null };
  skus: { company: string; itemCode: string; itemName: string | null; status: string | null }[];
};

function toCheckRow(index: MasterIndex, p: { id: string; itemName: string; promoType: string | null; promoPrice: number | null; file: CheckRow["file"]; skus: { company: string; itemCode: string }[] }): CheckRow {
  return {
    id: p.id, itemName: p.itemName, promoType: p.promoType, promoPrice: p.promoPrice, file: p.file,
    skus: p.skus.map((s) => { const m = index.byCode.get(s.itemCode); return { ...s, itemName: m?.itemName ?? null, status: m?.status ?? null }; }),
  };
}

/** Ringkasan + daftar Discontinued/Sebagian di IM aktif. */
export async function runImCheck() {
  const [index, products, removals] = await Promise.all([
    loadMasterIndex(),
    db.eDocImProduct.findMany({ where: { file: activeImFileWhere() }, select: productSelect, orderBy: [{ fileId: "asc" }, { itemName: "asc" }] }),
    db.eDocImProductRemoval.count({ where: { restoredAt: null } }),
  ]);
  const discontinued: CheckRow[] = [];
  const partial: CheckRow[] = [];
  let unmapped = 0, active = 0;
  for (const p of products) {
    const ev = evaluateMappedSkus(index, p.skus.map((s) => s.itemCode));
    if (ev.status === "ALL_DISCONTINUED") discontinued.push(toCheckRow(index, p));
    else if (ev.status === "PARTIAL") partial.push(toCheckRow(index, p));
    else if (p.skus.length === 0) unmapped++;
    else active++; // termasuk SKU yang tidak dikenal lagi (company/business dikecualikan) — diabaikan
  }
  return {
    summary: { total: products.length, active, discontinued: discontinued.length, partial: partial.length, unmapped, removed: removals },
    discontinued, partial,
  };
}

// ── Belum dipetakan ──────────────────────────────────────────────────────────────────────
export type UnmappedRow = CheckRow & {
  excelSku: string | null;
  suggestions: (SkuCandidate & { reason: "NAME" | "SIMILAR"; inScope: boolean })[];
  autoPick: string | null; // saran utama yang aman dipakai "Terapkan saran" (nama persis, 1 SKU aktif sesuai BU)
};

const UNMAPPED_PAGE = 50;

/** Item tanpa SKU di IM aktif + saran SKU by nama (HANYA saran — tidak ada yang tersimpan otomatis). */
export async function listUnmapped(q: string, page: number) {
  const where = {
    file: activeImFileWhere(), skus: { none: {} },
    ...(q ? { OR: [{ itemName: { contains: q, mode: "insensitive" as const } }, { file: { documentNumber: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const [index, total, products] = await Promise.all([
    loadMasterIndex(),
    db.eDocImProduct.count({ where }),
    db.eDocImProduct.findMany({ where, select: productSelect, orderBy: [{ fileId: "asc" }, { itemName: "asc" }], skip: (page - 1) * UNMAPPED_PAGE, take: UNMAPPED_PAGE }),
  ]);
  const rows: UnmappedRow[] = products.map((p) => {
    const res = resolveRow(index, p.itemName, p.file.businessUnitCodes, p.sku);
    const seen = new Set<string>();
    const suggestions: UnmappedRow["suggestions"] = [];
    const push = (c: SkuCandidate, reason: "NAME" | "SIMILAR", inScope: boolean) => {
      if (seen.has(c.itemCode) || suggestions.length >= 8) return;
      seen.add(c.itemCode); suggestions.push({ ...c, reason, inScope });
    };
    // Nama persis dulu (company sesuai BU di atas), lalu nama mirip.
    for (const co of res.companies) for (const c of co.candidates) push(c, "NAME", co.inScope);
    for (const s of res.suggestions) for (const c of index.byKey.get(matchKey(s.itemName)) ?? []) push(c, "SIMILAR", s.inScope);
    const selected = res.companies.map((c) => c.selected).filter((x): x is string => !!x);
    const autoPick = res.status === "MATCHED" && selected.length === 1 && index.byCode.get(selected[0])?.status === "ACTIVE" ? selected[0] : null;
    return { ...toCheckRow(index, p), excelSku: p.sku, suggestions, autoPick };
  });
  return { rows, total, page, pageSize: UNMAPPED_PAGE };
}

/** Cari Master Item manual (kode atau nama) untuk layar pemetaan. */
export async function searchMasterItems(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  return db.masterItem.findMany({
    where: { company: { not: null }, OR: [{ itemCode: { contains: term, mode: "insensitive" } }, { itemName: { contains: term, mode: "insensitive" } }] },
    select: { itemCode: true, itemName: true, company: true, business: true, itemGroup: true, status: true, standardPrice: true },
    orderBy: [{ status: "asc" }, { itemName: "asc" }], take: 20,
  });
}

/**
 * Simpan pemetaan item lama → SATU SKU (aturan sama dengan import: 1 baris 1 SKU, nama
 * disamakan ke nama resmi Master Item). SKU Discontinued BOLEH dipetakan (memang itu
 * faktanya) — item itu lalu muncul di daftar Discontinued untuk dikeluarkan.
 */
export async function mapProductSkus(input: unknown, userId: string): Promise<{ error: string } | { mapped: number }> {
  if (!Array.isArray(input) || input.length === 0) return { error: "Tidak ada pemetaan untuk disimpan" };
  if (input.length > 500) return { error: "Maksimal 500 pemetaan sekali simpan" };
  const pairs = input.map((x) => ({ productId: String((x as { productId?: unknown })?.productId ?? ""), itemCode: String((x as { itemCode?: unknown })?.itemCode ?? "").trim() }));
  const [products, masters] = await Promise.all([
    db.eDocImProduct.findMany({ where: { id: { in: pairs.map((p) => p.productId) } }, select: { id: true } }),
    db.masterItem.findMany({ where: { itemCode: { in: pairs.map((p) => p.itemCode) } }, select: { itemCode: true, itemName: true, company: true } }),
  ]);
  const productIds = new Set(products.map((p) => p.id));
  const master = new Map(masters.map((m) => [m.itemCode, m]));
  for (const p of pairs) {
    if (!productIds.has(p.productId)) return { error: "Item IM tidak ditemukan (mungkin sudah diganti/dikeluarkan) — muat ulang halaman" };
    const m = master.get(p.itemCode);
    if (!m) return { error: `SKU ${p.itemCode || "(kosong)"} tidak ada di Master Item` };
    if (!m.company) return { error: `SKU ${m.itemCode} tidak punya company di Master Item` };
  }
  await db.$transaction(async (tx) => {
    for (const p of pairs) {
      const m = master.get(p.itemCode)!;
      await tx.eDocImProductSku.deleteMany({ where: { productId: p.productId } });
      await tx.eDocImProduct.update({
        where: { id: p.productId },
        data: { itemName: m.itemName, sku: m.itemCode, skus: { create: { company: m.company!, itemCode: m.itemCode, mappedBy: userId } } },
      });
    }
  });
  return { mapped: pairs.length };
}

// ── Keluarkan & Kembalikan ───────────────────────────────────────────────────────────────
/** Keluarkan item yang SEMUA SKU-nya Discontinued (dicek ulang di server). */
export async function removeDiscontinued(productIds: unknown, userId: string): Promise<{ error: string } | { removed: number }> {
  if (!Array.isArray(productIds) || productIds.length === 0) return { error: "Pilih item yang akan dikeluarkan" };
  const ids = [...new Set(productIds.map(String))];
  const [index, products] = await Promise.all([
    loadMasterIndex(),
    db.eDocImProduct.findMany({ where: { id: { in: ids } }, include: { skus: { select: { company: true, itemCode: true, mappedBy: true, mappedAt: true } } } }),
  ]);
  if (products.length !== ids.length) return { error: "Sebagian item sudah tidak ada (mungkin sudah dikeluarkan/diganti) — muat ulang halaman" };
  for (const p of products) {
    if (evaluateMappedSkus(index, p.skus.map((s) => s.itemCode)).status !== "ALL_DISCONTINUED") {
      return { error: `${p.itemName}: tidak semua SKU-nya Discontinued — tidak dikeluarkan` };
    }
  }
  await db.$transaction(async (tx) => {
    for (const p of products) {
      const { skus, ...row } = p;
      await tx.eDocImProductRemoval.create({
        data: { fileId: p.fileId, productId: p.id, itemName: p.itemName, reason: "DISCONTINUED", removedBy: userId, snapshot: JSON.parse(JSON.stringify({ ...row, skus })) },
      });
    }
    await tx.eDocImProduct.deleteMany({ where: { id: { in: ids } } });
  });
  return { removed: ids.length };
}

export async function listRemovals(page: number, pageSize = 50) {
  const [total, rows] = await Promise.all([
    db.eDocImProductRemoval.count(),
    db.eDocImProductRemoval.findMany({ orderBy: { removedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const userIds = [...new Set(rows.flatMap((r) => [r.removedBy, r.restoredBy]).filter((x): x is string => !!x))];
  const [users, files] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    db.eDocFile.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.fileId))] } }, select: { id: true, title: true, documentNumber: true, deletedAt: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const file = new Map(files.map((f) => [f.id, f]));
  return {
    total, page, pageSize,
    data: rows.map((r) => {
      const snap = r.snapshot as { sku?: string | null; promoType?: string | null; promoPrice?: number | null; skus?: { company: string; itemCode: string }[] };
      const f = file.get(r.fileId);
      return {
        id: r.id, itemName: r.itemName, reason: r.reason, removedAt: r.removedAt, removedBy: userName.get(r.removedBy) ?? null,
        restoredAt: r.restoredAt, restoredBy: r.restoredBy ? userName.get(r.restoredBy) ?? null : null,
        skus: snap.skus ?? [], promoType: snap.promoType ?? null, promoPrice: snap.promoPrice ?? null,
        file: f ? { id: f.id, title: f.title, documentNumber: f.documentNumber, deleted: !!f.deletedAt } : null,
      };
    }),
  };
}

/** Kembalikan item dari snapshot ke IM asalnya (baris & mapping SKU dibuat ulang). */
export async function restoreRemoval(id: string, userId: string): Promise<{ error: string } | { restoredAsId: string }> {
  const r = await db.eDocImProductRemoval.findUnique({ where: { id } });
  if (!r) return { error: "Riwayat tidak ditemukan" };
  if (r.restoredAt) return { error: "Item ini sudah dikembalikan" };
  const file = await db.eDocFile.findFirst({ where: { id: r.fileId, deletedAt: null }, select: { id: true } });
  if (!file) return { error: "File IM asalnya sudah dihapus — item tidak bisa dikembalikan" };
  const s = r.snapshot as Record<string, unknown> & { skus?: { company: string; itemCode: string; mappedBy?: string }[] };
  const pick = <T,>(k: string) => (s[k] ?? null) as T;
  return db.$transaction(async (tx) => {
    // Klaim dulu (restoredAt masih null) — cegah dobel restore kalau diklik bersamaan.
    const claimed = await tx.eDocImProductRemoval.updateMany({ where: { id, restoredAt: null }, data: { restoredAt: new Date(), restoredBy: userId } });
    if (claimed.count === 0) return { error: "Item ini sudah dikembalikan" };
    const created = await tx.eDocImProduct.create({
      data: {
        fileId: r.fileId, itemName: r.itemName, sku: pick<string | null>("sku"), category: pick("category"), discountClass: pick("discountClass"),
        normalPrice: pick("normalPrice"), promoType: pick("promoType"), promoDetail: pick("promoDetail"), promoPrice: pick("promoPrice"),
        discountPercent: pick("discountPercent"), qty: pick("qty"), imNumber: pick("imNumber"), imSubject: pick("imSubject"),
        validity: pick("validity"), eligibleClient: pick("eligibleClient"), keyConditions: pick("keyConditions"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extra: (s.extra ?? undefined) as any,
        importedAt: s.importedAt ? new Date(String(s.importedAt)) : undefined, importedBy: pick<string>("importedBy") ?? userId,
        skus: { create: (s.skus ?? []).map((k) => ({ company: k.company, itemCode: k.itemCode, mappedBy: k.mappedBy ?? userId })) },
      },
    });
    await tx.eDocImProductRemoval.update({ where: { id }, data: { restoredAsId: created.id } });
    return { restoredAsId: created.id };
  });
}
