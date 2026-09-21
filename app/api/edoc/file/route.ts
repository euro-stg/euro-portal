import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { resolveFolderContentAccess, relocateExpiredFiles, uploadEDocFileToFolder, parseImProductImport, isSuperadmin, isEDocDocumentApprover } from "@/lib/edoc";

export const maxDuration = 60;

// List file dalam satu folder. Filter endDate adalah sumber kebenaran visibility —
// selalu diterapkan terlepas dari apakah physical move (relocateExpiredFiles) sudah
// jalan atau belum, supaya file yang sudah lewat endDate langsung hilang dari pandangan.
// (endDate dulu punya pasangan field terpisah "expiryDate" — digabung 2026-09-14.)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });

    const access = await resolveFolderContentAccess(userId, folderId);
    if (!access.folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });
    if (!access.canRead) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 }); // hidden, not 403

    // Housekeeping — tidak mempengaruhi hasil query di bawah (filter endDate independen).
    await relocateExpiredFiles(folderId).catch((e) => console.error("[edoc] relocateExpiredFiles gagal", e));

    const fileSelect = {
      id: true, title: true, description: true, categoryId: true, categoryTypeId: true,
      businessUnitCodes: true, branchIds: true, organizationId: true, startDate: true, endDate: true,
      fileUrl: true, requiresNumber: true, requiresItemImport: true, documentNumber: true, mocNumber: true, status: true,
      uploadedBy: true, approvedAt: true, createdAt: true, updatedAt: true,
      category: { select: { id: true, code: true, name: true } },
      categoryType: { select: { id: true, code: true, name: true } },
    } as const;
    const visibilityFilter = { deletedAt: null, OR: [{ endDate: null }, { endDate: { gt: new Date() } }] };

    // Isi listing = file yang folderId-nya PERSIS folder ini, DITAMBAH file dari folder lain
    // yang "Blast" ke sini (link, bukan copy — lihat EDocFileBlastFolder). Filter visibility
    // (endDate) berlaku sama untuk keduanya, jadi file yang sudah expired hilang dari
    // blast-nya juga, bukan cuma dari folder aslinya.
    const [ownFiles, blastLinks] = await Promise.all([
      db.eDocFile.findMany({ where: { folderId, ...visibilityFilter }, select: fileSelect, orderBy: { createdAt: "desc" } }),
      db.eDocFileBlastFolder.findMany({
        where: { folderId, file: visibilityFilter },
        select: { file: { select: fileSelect } },
      }),
    ]);
    const files = [...ownFiles, ...blastLinks.map((l) => l.file)];
    const blastedFileIds = new Set(blastLinks.map((l) => l.file.id));

    // DRAFT hanya kelihatan oleh superadmin, uploader-nya sendiri, atau Document Approver
    // (pool global) — bukan sekadar siapa saja yang punya ACL baca folder ini.
    const [superadmin, approver] = await Promise.all([isSuperadmin(userId), isEDocDocumentApprover(userId)]);
    const visibleFiles = (superadmin || approver ? files : files.filter((f) => (f.status !== "DRAFT" && f.status !== "REJECTED") || f.uploadedBy === userId))
      .map((f) => ({ ...f, isBlasted: blastedFileIds.has(f.id) }));

    return NextResponse.json({ data: visibleFiles, canWrite: access.canWrite });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

const ALLOWED_MIME = ["application/pdf"];

// Kalau requiresItemImport dicentang, Excel produk/promo WAJIB diupload di request yang
// SAMA (bukan langkah terpisah setelah file dibuat) — di-parse & divalidasi DULU, sebelum
// PDF diupload atau row EDocFile dibuat, supaya Excel yang gagal dibaca tidak meninggalkan
// file "setengah jadi" (tanpa item) yang butuh rollback.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    const title = (formData.get("title") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const categoryId = formData.get("categoryId") as string | null;
    const categoryTypeId = (formData.get("categoryTypeId") as string | null) || null;
    const businessUnitCodes = formData.getAll("businessUnitCodes").map(String).filter(Boolean);
    const branchIds = formData.getAll("branchIds").map(String).filter(Boolean);
    const organizationId = (formData.get("organizationId") as string | null) || null;
    const startDateRaw = formData.get("startDate") as string | null;
    const endDateRaw = formData.get("endDate") as string | null;
    const obsoleteDestinationFolderId = (formData.get("obsoleteDestinationFolderId") as string | null) || null;
    const blastFolderIds = formData.getAll("blastFolderIds").map(String).filter(Boolean);
    // Document Number/approval sekarang WAJIB untuk semua file — tidak lagi opsional dari
    // client (dihapus dari form upload 2026-09-18), selalu true terlepas dari apa yang
    // dikirim.
    const requiresNumber = true;
    const requiresItemImport = formData.get("requiresItemImport") === "true";
    const productExcel = formData.get("productExcel") as File | null;

    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });
    if (!title) return NextResponse.json({ message: "Title wajib diisi" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ message: "Category wajib dipilih" }, { status: 400 });
    if (!file) return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
    if (!ALLOWED_MIME.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ message: "Hanya file PDF yang diperbolehkan" }, { status: 400 });
    }

    const access = await resolveFolderContentAccess(userId, folderId);
    if (!access.folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });
    if (!access.canWrite) return NextResponse.json({ message: "Anda tidak memiliki akses tulis ke folder ini" }, { status: 403 });
    if (access.folder.type === "OBSOLETE") {
      return NextResponse.json({ message: "Tidak bisa upload langsung ke folder Obsolete" }, { status: 400 });
    }

    const category = await db.eDocCategory.findFirst({ where: { id: categoryId, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    if (categoryTypeId) {
      const categoryType = await db.eDocCategoryType.findFirst({ where: { id: categoryTypeId, categoryId } });
      if (!categoryType) return NextResponse.json({ message: "Category Type tidak sesuai dengan Category" }, { status: 400 });
    }

    const endDate = endDateRaw ? new Date(endDateRaw) : null;
    if (endDate) {
      if (isNaN(endDate.getTime())) return NextResponse.json({ message: "End date tidak valid" }, { status: 400 });
      if (!obsoleteDestinationFolderId) {
        return NextResponse.json({ message: "Pilih folder tujuan Obsolete jika mengisi end date" }, { status: 400 });
      }
      const dest = await db.eDocFolder.findFirst({ where: { id: obsoleteDestinationFolderId, deletedAt: null } });
      if (!dest || dest.type !== "OBSOLETE") {
        return NextResponse.json({ message: "Folder tujuan harus bertipe Obsolete" }, { status: 400 });
      }
    }

    // Blast — file yang sama juga muncul di listing folder lain (link, bukan copy fisik).
    // Bebas pilih folder manapun (TIDAK butuh akses write ke folder tujuan — beda dengan
    // upload biasa) — cuma tidak boleh ke folder Obsolete, sama seperti tidak boleh upload
    // langsung ke situ. Divalidasi sekarang, sebelum PDF diupload.
    const uniqueBlastFolderIds = Array.from(new Set(blastFolderIds.filter((id) => id !== folderId)));
    for (const bfId of uniqueBlastFolderIds) {
      const blastFolder = await db.eDocFolder.findFirst({ where: { id: bfId, deletedAt: null }, select: { type: true } });
      if (!blastFolder) return NextResponse.json({ message: "Folder tujuan blast tidak ditemukan" }, { status: 404 });
      if (blastFolder.type === "OBSOLETE") return NextResponse.json({ message: "Tidak bisa blast ke folder Obsolete" }, { status: 400 });
    }

    // Validasi & parse Excel produk/promo DULU (belum ada side effect apapun sampai titik
    // ini) — kalau requiresItemImport dicentang tapi Excel tidak ada/gagal dibaca, batalkan
    // di sini, sebelum PDF sempat diupload atau row EDocFile sempat dibuat.
    let parsedProducts: Awaited<ReturnType<typeof parseImProductImport>>["products"] = [];
    if (requiresItemImport) {
      if (!productExcel) {
        return NextResponse.json({ message: "File ini ditandai promo — Excel produk/item wajib diupload sekarang" }, { status: 400 });
      }
      try {
        parsedProducts = parseImProductImport(await productExcel.arrayBuffer()).products;
      } catch (e) {
        return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca Excel produk/item" }, { status: 400 });
      }
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${ts}-${safeName}`;
    const buffer = await file.arrayBuffer();
    const fileUrl = await uploadEDocFileToFolder(buffer, filename, folderId);

    const created = await db.eDocFile.create({
      data: {
        folderId,
        title,
        description,
        categoryId,
        categoryTypeId,
        businessUnitCodes,
        branchIds,
        organizationId,
        startDate: startDateRaw ? new Date(startDateRaw) : null,
        endDate,
        obsoleteDestinationFolderId,
        fileUrl,
        requiresNumber,
        requiresItemImport,
        status: "DRAFT",
        uploadedBy: userId,
      },
    });

    if (uniqueBlastFolderIds.length > 0) {
      await db.eDocFileBlastFolder.createMany({
        data: uniqueBlastFolderIds.map((bfId) => ({ fileId: created.id, folderId: bfId, createdBy: userId })),
      });
    }

    if (parsedProducts.length > 0) {
      await db.$transaction(
        parsedProducts.map((p) =>
          db.eDocImProduct.create({
            data: {
              fileId: created.id, itemName: p.itemName, sku: p.sku, category: p.category, discountClass: p.discountClass,
              normalPrice: p.normalPrice, promoType: p.promoType, promoDetail: p.promoDetail, promoPrice: p.promoPrice,
              discountPercent: p.discountPercent, qty: p.qty, imNumber: p.imNumber, imSubject: p.imSubject,
              validity: p.validity, eligibleClient: p.eligibleClient, keyConditions: p.keyConditions,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              extra: p.extra as any, importedBy: userId,
            },
          })
        )
      );
    }

    return NextResponse.json({ data: created, importedProducts: parsedProducts.length }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
