import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import {
  resolveFolderContentAccessBatch, resolveFolderVisibilityBatch, getEDocFolderBreadcrumb,
  isSuperadmin, isEDocDocumentApprover,
} from "@/lib/edoc";

const RESULT_LIMIT = 50;

// Pencarian global E Document — file (Title/Description/Document Number/MOC Number) +
// folder (nama), lintas seluruh tree yang user punya akses (bukan cuma folder yang lagi
// dibuka). ACL diterapkan SETELAH query broad (bukan di WHERE clause) — jumlah folder unik
// di kandidat hasil biasanya jauh lebih sedikit dari jumlah file, jadi resolve akses per
// folder (dedup) lebih murah daripada re-derive ACL langsung di SQL.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const categoryId = searchParams.get("categoryId") || "";
    const categoryTypeId = searchParams.get("categoryTypeId") || "";
    const status = searchParams.get("status") || "";
    const businessUnitCode = searchParams.get("businessUnitCode") || "";
    const validFrom = searchParams.get("validFrom") || "";
    const validTo = searchParams.get("validTo") || "";

    if (!q && !categoryId && !categoryTypeId && !status && !businessUnitCode && !validFrom && !validTo) {
      return NextResponse.json({ data: { files: [], folders: [] } });
    }

    // ---------- Files ----------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileWhere: any = {
      deletedAt: null,
      AND: [{ OR: [{ endDate: null }, { endDate: { gt: new Date() } }] }],
    };
    if (categoryId) fileWhere.categoryId = categoryId;
    if (categoryTypeId) fileWhere.categoryTypeId = categoryTypeId;
    if (status) fileWhere.status = status;
    if (businessUnitCode) fileWhere.businessUnitCodes = { has: businessUnitCode };
    // "Masih berlaku pada rentang [validFrom, validTo]" = overlap check terhadap interval
    // startDate/endDate file itu sendiri, BUKAN startDate/endDate harus persis di dalam
    // rentang. File tanpa startDate/endDate dianggap "berlaku selamanya" (tidak dibatasi),
    // jadi selalu ikut cocok — null di salah satu sisi berarti sisi itu tidak membatasi.
    if (validTo) {
      fileWhere.AND.push({ OR: [{ startDate: null }, { startDate: { lte: new Date(validTo) } }] });
    }
    if (validFrom) {
      fileWhere.AND.push({ OR: [{ endDate: null }, { endDate: { gte: new Date(validFrom) } }] });
    }
    if (q) {
      // File Category IM juga dicari lewat detail item/promo yang di-attach ke dalamnya —
      // nama item, kategori, jenis promo, masa berlaku, client, ketentuan (semua teks bebas,
      // contains case-insensitive), plus Discount % secara numerik kalau query berupa angka
      // (dengan/tanpa tanda "%", mis. "20%" atau "20" -> cocokkan discountPercent = 20).
      const percentMatch = q.match(/^(\d+(?:\.\d+)?)\s*%?$/);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imProductOr: any[] = [
        { itemName: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { discountClass: { contains: q, mode: "insensitive" } },
        { promoType: { contains: q, mode: "insensitive" } },
        { promoDetail: { contains: q, mode: "insensitive" } },
        { validity: { contains: q, mode: "insensitive" } },
        { eligibleClient: { contains: q, mode: "insensitive" } },
        { keyConditions: { contains: q, mode: "insensitive" } },
      ];
      if (percentMatch) imProductOr.push({ discountPercent: Number(percentMatch[1]) });

      fileWhere.AND.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { documentNumber: { contains: q, mode: "insensitive" } },
          { mocNumber: { contains: q, mode: "insensitive" } },
          { imProducts: { some: { OR: imProductOr } } },
        ],
      });
    }

    const candidateFiles = await db.eDocFile.findMany({
      where: fileWhere,
      select: {
        id: true, title: true, description: true, documentNumber: true, mocNumber: true, status: true,
        folderId: true, uploadedBy: true, createdAt: true, startDate: true, endDate: true,
        category: { select: { id: true, code: true, name: true } },
        categoryType: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT * 3, // over-fetch a bit before ACL filtering trims it down
    });

    // DRAFT files bypass folder ACL entirely for superadmin/Document Approver/its own
    // uploader (flat global pool, same rule as the pending-approval queue and the file
    // detail route) — everyone else never sees a DRAFT file in search, regardless of
    // folder ACL. RELEASE files fall back to normal folder ACL through EITHER their own
    // folder OR any "Blast" folder they're also linked into (same union rule as
    // resolveFileReadAccess — Blast is a real access grant, not just a label).
    const [superadmin, approver] = await Promise.all([isSuperadmin(userId), isEDocDocumentApprover(userId)]);
    const draftBypass = superadmin || approver;
    const fileFolderAccess = await resolveFolderContentAccessBatch(userId, candidateFiles.map((f) => f.folderId));

    const blastLinks = await db.eDocFileBlastFolder.findMany({
      where: { fileId: { in: candidateFiles.map((f) => f.id) } },
      select: { fileId: true, folderId: true },
    });
    const blastFolderIdsByFile = new Map<string, string[]>();
    for (const link of blastLinks) {
      blastFolderIdsByFile.set(link.fileId, [...(blastFolderIdsByFile.get(link.fileId) ?? []), link.folderId]);
    }
    const blastFolderAccess = await resolveFolderContentAccessBatch(userId, blastLinks.map((l) => l.folderId));

    const visibleFiles = candidateFiles
      .filter((f) => {
        if (f.status === "DRAFT" || f.status === "REJECTED") return draftBypass || f.uploadedBy === userId;
        if (fileFolderAccess.get(f.folderId)?.canRead) return true;
        return (blastFolderIdsByFile.get(f.id) ?? []).some((bid) => blastFolderAccess.get(bid)?.canRead);
      })
      .slice(0, RESULT_LIMIT);
    const files = await Promise.all(
      visibleFiles.map(async (f) => ({ ...f, folderBreadcrumb: await getEDocFolderBreadcrumb(f.folderId) }))
    );

    // ---------- Folders (name match only — filters below are file-specific fields) ----------
    let folders: { id: string; name: string; type: string; breadcrumb: { id: string; name: string }[] }[] = [];
    if (q) {
      const candidateFolders = await db.eDocFolder.findMany({
        where: { deletedAt: null, name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT * 3,
      });

      const folderVisibility = await resolveFolderVisibilityBatch(userId, candidateFolders.map((f) => f.id));
      const visibleFolders = candidateFolders.filter((f) => folderVisibility.get(f.id)).slice(0, RESULT_LIMIT);

      folders = await Promise.all(
        visibleFolders.map(async (f) => ({ id: f.id, name: f.name, type: f.type, breadcrumb: await getEDocFolderBreadcrumb(f.id) }))
      );
    }

    return NextResponse.json({ data: { files, folders } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
