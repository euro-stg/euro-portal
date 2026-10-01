import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { parseImProductImport, extractDocumentNumberFromFilename, isSuperadmin, isEDocFolderCreator } from "@/lib/edoc";

export const maxDuration = 120;

// Bulk Import Item (2026-09-25) — pelengkap fase migrasi Bulk Upload: 1 Excel BESAR berisi
// promo/item dari BANYAK file IM sekaligus (bukan 1 file seperti /api/edoc/im-product/import
// biasa), dicocokkan ke file yang tepat lewat kolom "IM Number" di Excel <-> Document Number
// file. Juga MENCAKUP file yang sudah lebih dulu di-bulk-upload sebelum fitur auto-nomor ada
// (documentNumber masih kosong) — di-backfill dulu dari title-nya (title = nama file asli,
// lihat extractDocumentNumberFromFilename), DAN file yang documentNumber-nya sudah ke-set
// tapi masih format lama (underscore, sebelum dikonversi ke slash — bug yang diperbaiki
// sama hari) — diperbaiki dulu juga, sebelum proses pencocokan jalan. Jadi 1 langkah ini
// sekaligus "perbaiki nomor yang kelupaan/salah format" + "isi item-nya".
//
// Akses: SENGAJA lebih ketat dari Bulk Upload biasa (yang cukup write-ACL 1 folder) — tool
// ini beroperasi lintas SEMUA file Category IM sekaligus, tanpa terikat 1 folder, termasuk
// file yang bukan diupload user ini sendiri. Superadmin atau Folder Creator saja.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, folderCreator] = await Promise.all([isSuperadmin(userId), isEDocFolderCreator(userId)]);
    if (!superadmin && !folderCreator) {
      return NextResponse.json({ message: "Bulk Import Item hanya untuk Folder Creator/superadmin" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });

    let products, warnings;
    try {
      ({ products, warnings } = parseImProductImport(await file.arrayBuffer()));
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
    }

    // ---------- Fase 0: backfill requiresItemImport=true untuk file bulk IM lama yang
    // masih false (2026-09-30 — item promo dijadikan wajib untuk bulk upload Category IM,
    // baik yang baru maupun yang sudah terlanjur diupload sebelum aturan ini ada). Cuma
    // menyalakan flag-nya (efeknya: section "Produk/Promo Terkait" jadi tampil di halaman
    // detail file) — TIDAK menghapus/mengganggu file yang kebetulan sudah punya item.
    const itemImportFlagBackfilled = await db.eDocFile.updateMany({
      where: { deletedAt: null, bulkImported: true, requiresItemImport: false, category: { code: "IM" } },
      data: { requiresItemImport: true },
    });

    // ---------- Fase 1a: backfill Document Number file lama yang masih kosong ----------
    const candidates = await db.eDocFile.findMany({
      where: { deletedAt: null, documentNumber: null, category: { code: "IM" } },
      select: { id: true, title: true },
    });
    const usedNumbers = new Set(
      (await db.eDocFile.findMany({ where: { deletedAt: null, documentNumber: { not: null } }, select: { documentNumber: true } }))
        .map((f) => f.documentNumber as string)
    );
    const backfilled: { fileId: string; title: string; documentNumber: string }[] = [];
    for (const c of candidates) {
      const detected = extractDocumentNumberFromFilename(c.title);
      if (!detected || usedNumbers.has(detected)) continue;
      await db.eDocFile.update({ where: { id: c.id }, data: { documentNumber: detected } });
      usedNumbers.add(detected);
      backfilled.push({ fileId: c.id, title: c.title, documentNumber: detected });
    }

    // ---------- Fase 1b: perbaiki Document Number yang sudah kadung ke-set format lama
    // (underscore, bukan slash) — bug di extractDocumentNumberFromFilename sempat
    // menyimpan "001_Euromedica_..." apa adanya sebelum diperbaiki jadi "001/Euromedica/..."
    // (2026-09-25, sama hari). Deteksi HATI-HATI: cuma dianggap "hasil auto-generate lama"
    // kalau title file itu literally diawali "<documentNumber tersimpan> " — sinyal kuat
    // bahwa angka itu memang berasal dari nama file (bukan diketik manual user lewat Edit,
    // yang kebetulan mengandung underscore) — supaya tidak menimpa input manual siapapun.
    const staleCandidates = await db.eDocFile.findMany({
      where: { deletedAt: null, documentNumber: { not: null, contains: "_" }, category: { code: "IM" } },
      select: { id: true, title: true, documentNumber: true },
    });
    const repaired: { fileId: string; title: string; oldDocumentNumber: string; documentNumber: string }[] = [];
    for (const c of staleCandidates) {
      const old = c.documentNumber as string;
      if (!c.title.startsWith(`${old} `)) continue; // bukan hasil auto-generate, jangan disentuh
      const corrected = extractDocumentNumberFromFilename(c.title);
      if (!corrected || corrected === old || usedNumbers.has(corrected)) continue;
      await db.eDocFile.update({ where: { id: c.id }, data: { documentNumber: corrected } });
      usedNumbers.delete(old);
      usedNumbers.add(corrected);
      repaired.push({ fileId: c.id, title: c.title, oldDocumentNumber: old, documentNumber: corrected });
    }

    // ---------- Fase 2: kelompokkan baris Excel per IM Number, cari file yang cocok ----------
    // Case-insensitive (2026-09-30) — Excel sering diketik manual ("Euromedica" vs
    // "EUROMEDICA" di Document Number asli), jadi dicocokkan lewat key huruf kecil semua,
    // tapi casing ASLI tetap disimpan untuk ditampilkan (documentNumber asli file utk
    // matched, teks asli Excel utk unmatched) supaya tidak membingungkan di hasil akhir.
    const byNumber = new Map<string, { fileId: string; documentNumber: string }>(); // documentNumber.toLowerCase() -> {fileId, documentNumber asli}
    for (const f of await db.eDocFile.findMany({
      where: { deletedAt: null, documentNumber: { not: null }, category: { code: "IM" } },
      select: { id: true, documentNumber: true },
    })) {
      byNumber.set((f.documentNumber as string).toLowerCase(), { fileId: f.id, documentNumber: f.documentNumber as string });
    }

    const groups = new Map<string, { original: string; rows: typeof products }>();
    let skippedNoImNumber = 0;
    for (const p of products) {
      const raw = p.imNumber?.trim();
      if (!raw) { skippedNoImNumber++; continue; }
      const key = raw.toLowerCase();
      const existing = groups.get(key);
      if (existing) existing.rows.push(p);
      else groups.set(key, { original: raw, rows: [p] });
    }

    const matched: { documentNumber: string; fileId: string; title: string; itemsImported: number }[] = [];
    const unmatched: { imNumber: string; rowCount: number }[] = [];

    for (const [key, { original, rows }] of groups) {
      const match = byNumber.get(key);
      if (!match) { unmatched.push({ imNumber: original, rowCount: rows.length }); continue; }
      const { fileId, documentNumber } = match;

      // Delete-then-insert per file — sama seperti /api/edoc/im-product/import biasa,
      // supaya konsisten kalau tool ini dijalankan berulang (re-run aman, tidak numpuk).
      const created = await db.$transaction(async (tx) => {
        await tx.eDocImProduct.deleteMany({ where: { fileId } });
        return Promise.all(
          rows.map((p) =>
            tx.eDocImProduct.create({
              data: {
                fileId, itemName: p.itemName, sku: p.sku, category: p.category, discountClass: p.discountClass,
                normalPrice: p.normalPrice, promoType: p.promoType, promoDetail: p.promoDetail, promoPrice: p.promoPrice,
                discountPercent: p.discountPercent, qty: p.qty, imNumber: p.imNumber, imSubject: p.imSubject,
                validity: p.validity, eligibleClient: p.eligibleClient, keyConditions: p.keyConditions,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                extra: p.extra as any, importedBy: userId,
              },
            })
          )
        );
      });

      const file = await db.eDocFile.findUnique({ where: { id: fileId }, select: { title: true } });
      matched.push({ documentNumber, fileId, title: file?.title ?? "-", itemsImported: created.length });
    }

    return NextResponse.json({
      itemImportFlagBackfilled: itemImportFlagBackfilled.count,
      backfilled, repaired, matched, unmatched, skippedNoImNumber, warnings,
    }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
