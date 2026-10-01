import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { resolveFolderContentAccessBatch } from "@/lib/edoc";

const PAGE_SIZE = 30;

// Lookup dari 1 tabel yang sama, 2 mode:
//   ?fileId=xxx -> file IM ini terkait item/promo apa saja (dipakai halaman detail file,
//                  sudah ada dari awal — akses sudah digate di level halaman itu sendiri
//                  lewat canViewFile, jadi TIDAK perlu re-check ACL lagi di sini).
//   (default, tanpa fileId) -> mode "Item/Promo Browser" (2026-09-25) — cari/filter promo
//                  lintas SEMUA file IM sekaligus, dengan cursor pagination. Folder-ACL
//                  check-nya (resolveFolderContentAccessBatch) Blast-aware juga.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (fileId) {
      const products = await db.eDocImProduct.findMany({ where: { fileId }, orderBy: { itemName: "asc" } });
      return NextResponse.json({ data: products });
    }

    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const discountClass = searchParams.get("discountClass")?.trim() || "";
    const promoType = searchParams.get("promoType")?.trim() || "";
    const eligibleClient = searchParams.get("eligibleClient")?.trim() || "";
    const imNumber = searchParams.get("imNumber")?.trim() || "";
    const validFrom = searchParams.get("validFrom") || "";
    const validTo = searchParams.get("validTo") || "";
    const cursor = searchParams.get("cursor");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileWhere: any = {
      deletedAt: null,
      status: "RELEASE",
      folder: { type: { not: "OBSOLETE" } },
      AND: [{ OR: [{ endDate: null }, { endDate: { gt: new Date() } }] }],
    };
    // Sama persis logic overlap di GET /api/edoc/search — "masih berlaku pada rentang
    // [validFrom, validTo]" terhadap startDate/endDate FILE (bukan teks validity per item,
    // yang bebas format dari Excel jadi tidak bisa dipakai filter rentang tanggal akurat).
    if (validTo) fileWhere.AND.push({ OR: [{ startDate: null }, { startDate: { lte: new Date(validTo) } }] });
    if (validFrom) fileWhere.AND.push({ OR: [{ endDate: null }, { endDate: { gte: new Date(validFrom) } }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productWhere: any = { file: fileWhere };
    // q juga mencocokkan Eligible Client (2026-09-29) — kotak filter terpisahnya sendiri
    // tetap ada (untuk filter presisi), ini cuma menambah cakupan kotak pencarian utama.
    // IM Number SENGAJA TIDAK ikut di sini (dicoba sebentar, lalu di-revert atas permintaan
    // user) — dipisah jadi kotak filter sendiri di bawah, konsisten dengan Category/
    // Discount Class/Promo Type/Eligible Client yang semuanya juga kotak terpisah, bukan
    // bagian dari pencarian bebas.
    if (q) {
      productWhere.OR = [
        { itemName: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { eligibleClient: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) productWhere.category = { contains: category, mode: "insensitive" };
    if (discountClass) productWhere.discountClass = { contains: discountClass, mode: "insensitive" };
    if (promoType) productWhere.promoType = { contains: promoType, mode: "insensitive" };
    if (imNumber) productWhere.imNumber = { contains: imNumber, mode: "insensitive" };
    if (eligibleClient) productWhere.eligibleClient = { contains: eligibleClient, mode: "insensitive" };
    const percentMatch = q.match(/^(\d+(?:\.\d+)?)\s*%?$/);
    if (percentMatch) {
      // Kalau q berupa angka murni (mis. "20" atau "20%"), cocokkan JUGA sebagai
      // discountPercent (selain sebagai teks di itemName/sku di atas) — union, bukan ganti.
      productWhere.OR = [...(productWhere.OR ?? []), { discountPercent: Number(percentMatch[1]) }];
    }

    // Bug nyata ditemukan 2026-10-01 (dilaporkan user, lewat testing akun biasa — bukan
    // superadmin): versi SEBELUMNYA mengambil PAGE_SIZE kandidat TERBARU dulu (take di DB,
    // orderBy importedAt desc), BARU menyaring ACL di memory sesudahnya — kalau item yang
    // boleh dilihat user ini kebetulan tidak ada di antara 30 item terbaru SE-SISTEM (mis.
    // user/folder lain baru saja import lebih banyak), halaman pertama bisa tampil KOSONG
    // SAMA SEKALI buat user itu walau dia punya banyak item yang sebenarnya bisa dia lihat
    // lebih jauh di bawah — dan karena UI menampilkan empty-state (bukan sentinel infinite-
    // scroll) saat list kosong, "load more" otomatis tidak pernah terpicu, jadi macet
    // selamanya KECUALI user mengubah filter (search) yang kebetulan mempersempit kandidat
    // sampai item miliknya ikut ke-include di halaman pertama. Superadmin tidak pernah
    // kena karena ACL-nya selalu lolos semua, jadi "page" dan "visible" selalu sama persis.
    //
    // Fix: ACL+Blast SEKARANG dihitung terhadap SELURUH kandidat yang cocok filter (bukan
    // cuma 1 halaman), baru pagination (cursor/take) diterapkan DI ATAS daftar yang sudah
    // benar-benar correct-ACL itu — supaya tiap halaman dijamin berisi item yang BENAR bisa
    // dilihat user ini, bukan "kebetulan ada di top-N global lalu lolos ACL".
    const allMatching = await db.eDocImProduct.findMany({
      where: productWhere,
      include: { file: { select: { id: true, title: true, documentNumber: true, status: true, folderId: true, startDate: true, endDate: true } } },
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    });

    const folderAccess = await resolveFolderContentAccessBatch(userId, allMatching.map((p) => p.file.folderId));
    const blastLinks = await db.eDocFileBlastFolder.findMany({
      where: { fileId: { in: allMatching.map((p) => p.file.id) } },
      select: { fileId: true, folderId: true },
    });
    const blastFolderIdsByFile = new Map<string, string[]>();
    for (const link of blastLinks) {
      blastFolderIdsByFile.set(link.fileId, [...(blastFolderIdsByFile.get(link.fileId) ?? []), link.folderId]);
    }
    const blastFolderAccess = await resolveFolderContentAccessBatch(userId, blastLinks.map((l) => l.folderId));

    // "Aktif" (RELEASE + belum expired + bukan Obsolete) BUKAN berarti user ini boleh
    // melihatnya — folder ACL yang menentukan itu, lewat SALAH SATU dari: folder asal file
    // itu sendiri, ATAU folder manapun yang jadi tujuan Blast-nya (union, sama seperti
    // resolveFileReadAccess) — bukan cuma folder asal saja.
    const visibleAll = allMatching.filter((p) => {
      if (folderAccess.get(p.file.folderId)?.canRead) return true;
      return (blastFolderIdsByFile.get(p.file.id) ?? []).some((bid) => blastFolderAccess.get(bid)?.canRead);
    });

    const startIndex = cursor ? visibleAll.findIndex((p) => p.id === cursor) + 1 : 0;
    const pageSlice = visibleAll.slice(startIndex, startIndex + PAGE_SIZE + 1);
    const hasMore = pageSlice.length > PAGE_SIZE;
    const visible = pageSlice.slice(0, PAGE_SIZE);
    const nextCursor = hasMore ? visible[visible.length - 1]?.id ?? null : null;

    // Total item yang BENAR-BENAR terlihat user ini untuk filter yang lagi aktif — cuma
    // dikirim di halaman pertama (`!cursor`), sama seperti "N File" di daftar file folder.
    const totalCount = cursor ? null : visibleAll.length;

    return NextResponse.json({ data: visible, hasMore, nextCursor, totalCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
