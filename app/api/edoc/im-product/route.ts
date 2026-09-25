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
//                  lintas SEMUA file IM sekaligus, dengan cursor pagination. Ini yang BARU
//                  ditambah folder-ACL check (resolveFolderContentAccessBatch) — SEBELUMNYA
//                  mode ini (waktu masih bernama ?itemName=, belum pernah dipanggil dari UI
//                  manapun) tidak mengecek ACL folder user sama sekali, cuma "aktif"
//                  (RELEASE, belum expired, bukan di folder Obsolete). Sengaja TIDAK Blast-
//                  aware (beda dari GET /api/edoc/search) — kompleksitasnya tidak sepadan
//                  untuk halaman ini, folder aslinya sudah cukup buat kebanyakan kasus.
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
    if (q) productWhere.OR = [{ itemName: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
    if (category) productWhere.category = { contains: category, mode: "insensitive" };
    if (discountClass) productWhere.discountClass = { contains: discountClass, mode: "insensitive" };
    if (promoType) productWhere.promoType = { contains: promoType, mode: "insensitive" };
    if (eligibleClient) productWhere.eligibleClient = { contains: eligibleClient, mode: "insensitive" };
    const percentMatch = q.match(/^(\d+(?:\.\d+)?)\s*%?$/);
    if (percentMatch) {
      // Kalau q berupa angka murni (mis. "20" atau "20%"), cocokkan JUGA sebagai
      // discountPercent (selain sebagai teks di itemName/sku di atas) — union, bukan ganti.
      productWhere.OR = [...(productWhere.OR ?? []), { discountPercent: Number(percentMatch[1]) }];
    }

    const candidates = await db.eDocImProduct.findMany({
      where: productWhere,
      include: { file: { select: { id: true, title: true, documentNumber: true, status: true, folderId: true, startDate: true, endDate: true } } },
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = candidates.length > PAGE_SIZE;
    const page = candidates.slice(0, PAGE_SIZE);
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    // Baru ditambah (2026-09-25) — sebelumnya endpoint ini (dulu ?itemName=) TIDAK pernah
    // dipanggil dari UI manapun jadi celah ini belum pernah kena, tapi tetap gap ACL nyata:
    // "aktif" (RELEASE + belum expired + bukan Obsolete) BUKAN berarti user ini boleh
    // melihatnya — folder ACL folder-nya sendiri yang menentukan itu.
    const folderAccess = await resolveFolderContentAccessBatch(userId, page.map((p) => p.file.folderId));
    const visible = page.filter((p) => folderAccess.get(p.file.folderId)?.canRead);

    return NextResponse.json({ data: visible, hasMore, nextCursor });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
