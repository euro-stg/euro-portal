import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { resolveFolderContentAccess, uploadEDocFileToFolder, isSuperadmin, isEDocFolderCreator } from "@/lib/edoc";

export const maxDuration = 120;

const ALLOWED_MIME = ["application/pdf"];

// Bulk Import (2026-09-21) — migrasi awal dokumen lama: banyak PDF sekaligus, dump ke 1
// folder tujuan, BYPASS approval sepenuhnya (requiresNumber=false, langsung status
// RELEASE — tidak pernah singgah di DRAFT/antrian approval). Title = nama file apa adanya
// (tanpa ekstensi) — sengaja minim input di sini, field lain (dates, BU/branch, Document
// Number manual, dst) dilengkapi belakangan lewat PATCH /api/edoc/file/[id]. Setiap baris
// hasil endpoint ini ditandai `bulkImported: true` supaya (a) UI bisa kasih badge "perlu
// dilengkapi", dan (b) Folder Creator manapun — bukan cuma uploader aslinya — boleh bantu
// melengkapi lewat canEditFileMetadata.
//
// Akses: gerbang ganda — role Folder Creator (global, sama seperti bikin folder), DAN
// tetap harus punya write ACL ke folder tujuan yang sebenarnya (folder tujuan bisa saja
// bukan folder yang mereka buat sendiri) — Folder Creator TIDAK otomatis bisa nulis ke
// folder manapun, cuma boleh PAKAI fitur bulk upload ini kalau memang punya akses.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, folderCreator] = await Promise.all([isSuperadmin(userId), isEDocFolderCreator(userId)]);
    if (!superadmin && !folderCreator) {
      return NextResponse.json({ message: "Bulk Import hanya untuk Folder Creator/superadmin" }, { status: 403 });
    }

    const formData = await request.formData();
    const folderId = formData.get("folderId") as string | null;
    const categoryId = formData.get("categoryId") as string | null;
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ message: "Category wajib dipilih" }, { status: 400 });
    if (files.length === 0) return NextResponse.json({ message: "Minimal 1 file PDF wajib diupload" }, { status: 400 });

    const access = await resolveFolderContentAccess(userId, folderId);
    if (!access.folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });
    if (!access.canWrite) return NextResponse.json({ message: "Anda tidak memiliki akses tulis ke folder ini" }, { status: 403 });
    if (access.folder.type === "OBSOLETE") {
      return NextResponse.json({ message: "Tidak bisa upload langsung ke folder Obsolete" }, { status: 400 });
    }

    const category = await db.eDocCategory.findFirst({ where: { id: categoryId, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    // Sekuensial (bukan Promise.all) — banyak file besar diupload ke Nextcloud satu per
    // satu, lebih aman daripada membombardir koneksi WebDAV sekaligus; juga bikin hasil
    // per-file gampang dilacak kalau ada yang gagal di tengah jalan.
    const results: { filename: string; success: boolean; fileId?: string; error?: string }[] = [];
    for (const file of files) {
      try {
        if (!ALLOWED_MIME.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
          results.push({ filename: file.name, success: false, error: "Bukan file PDF" });
          continue;
        }

        const title = file.name.replace(/\.[^./]+$/, "").trim() || file.name;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filename = `${ts}-${safeName}`;
        const buffer = await file.arrayBuffer();
        const fileUrl = await uploadEDocFileToFolder(buffer, filename, folderId);

        const created = await db.eDocFile.create({
          data: {
            folderId,
            title,
            categoryId,
            requiresNumber: false,
            status: "RELEASE",
            bulkImported: true,
            uploadedBy: userId,
            fileUrl,
          },
        });
        results.push({ filename: file.name, success: true, fileId: created.id });
      } catch (e) {
        console.error("[edoc] bulk upload gagal untuk", file.name, e);
        results.push({ filename: file.name, success: false, error: e instanceof Error ? e.message : "Gagal upload" });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return NextResponse.json({ data: results, succeeded, failed: results.length - succeeded }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
