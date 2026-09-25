import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { resolveFolderContentAccess, uploadEDocFileToFolder, extractDocumentNumberFromFilename } from "@/lib/edoc";

export const maxDuration = 120;

const ALLOWED_MIME = ["application/pdf"];

// Bulk Import (2026-09-21) — migrasi awal dokumen lama, dump ke 1 folder tujuan, BYPASS
// approval sepenuhnya (requiresNumber=false, langsung status RELEASE — tidak pernah
// singgah di DRAFT/antrian approval). Title = nama file apa adanya (tanpa ekstensi) —
// sengaja minim input di sini, field lain (dates, BU/branch, Document Number manual, dst)
// dilengkapi belakangan lewat PATCH /api/edoc/file/[id]. Setiap baris hasil endpoint ini
// ditandai `bulkImported: true` supaya (a) UI bisa kasih badge "perlu dilengkapi", dan
// (b) Folder Creator/pemegang write ACL folder manapun — bukan cuma uploader aslinya —
// boleh bantu melengkapi lewat canEditFileMetadata.
//
// SATU FILE PER REQUEST (diubah 2026-09-22, sebelumnya nerima banyak `files[]` sekaligus
// dalam 1 request) — client (BulkUploadModal) sekarang loop manggil endpoint ini sekali
// per file lewat XMLHttpRequest, bukan membungkus semua file jadi 1 request raksasa.
// Alasannya dua: (1) fetch/XHR cuma kasih event progress granular per REQUEST, jadi
// butuh 1 request per file supaya progress bar per file itu punya arti; (2) 1 request
// gagal (jaringan putus/timeout) cuma menggagalkan FILE ITU, bukan seluruh batch — file
// lain yang request-nya terpisah tidak ikut terpengaruh, dan retry cukup untuk file yang
// gagal saja (tidak berisiko file yang sudah sukses ke-upload ulang jadi dobel).
//
// Akses: sama seperti upload biasa — cuma butuh write ACL ke folder tujuan
// (resolveFolderContentAccess), tidak ada role tambahan yang digate di sini.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const formData = await request.formData();
    const folderId = formData.get("folderId") as string | null;
    const categoryId = formData.get("categoryId") as string | null;
    const file = formData.get("file") as File | null;
    // Idempotency key (2026-09-22) — client generate 1 key acak per file, dikirim ulang
    // apa adanya kalau file ini di-retry. Kalau server SUDAH pernah berhasil membuat file
    // dengan key ini (percobaan sebelumnya sukses tapi response-nya tidak sempat sampai ke
    // client, mis. koneksi putus persis di detik terakhir), kembalikan row yang SUDAH ADA
    // apa adanya — JANGAN buat file baru — supaya retry tidak pernah menghasilkan dobel.
    const idempotencyKey = (formData.get("idempotencyKey") as string | null) || null;

    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ message: "Category wajib dipilih" }, { status: 400 });
    if (!file) return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
    if (!ALLOWED_MIME.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ message: "Hanya file PDF yang diperbolehkan" }, { status: 400 });
    }

    if (idempotencyKey) {
      const existing = await db.eDocFile.findFirst({ where: { bulkUploadKey: idempotencyKey, deletedAt: null } });
      if (existing) return NextResponse.json({ data: existing, deduped: true }, { status: 200 });
    }

    const access = await resolveFolderContentAccess(userId, folderId);
    if (!access.folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });
    if (!access.canWrite) return NextResponse.json({ message: "Anda tidak memiliki akses tulis ke folder ini" }, { status: 403 });
    if (access.folder.type === "OBSOLETE") {
      return NextResponse.json({ message: "Tidak bisa upload langsung ke folder Obsolete" }, { status: 400 });
    }

    const category = await db.eDocCategory.findFirst({ where: { id: categoryId, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    const title = file.name.replace(/\.[^./]+$/, "").trim() || file.name;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${ts}-${safeName}`;
    const buffer = await file.arrayBuffer();

    // Auto-deteksi Document Number dari nama file asli (2026-09-25) — file arsip lama
    // migrasi biasanya diberi nama "<nomor>_<dst> <judul bebas>.pdf". Kalau TIDAK ketemu
    // pola yang meyakinkan sama sekali, documentNumber tetap kosong seperti biasa (tidak
    // masalah, bisa diisi manual belakangan lewat Edit). TAPI kalau pola-nya KETEMU dan
    // ternyata sudah dipakai file lain, itu tanda nyata ada dobel di arsip — file INI
    // digagalkan dengan pesan jelas (2026-09-25, per feedback: jangan diam-diam kosongkan
    // nomornya, karena dobel semacam ini gampang lolos tanpa disadari). Dicek SEBELUM
    // upload ke Nextcloud, supaya file yang gagal tidak sempat ninggalin sampah fisik.
    // File lain dalam batch yang sama TIDAK terpengaruh — tetap request terpisah per file.
    const detectedNumber = extractDocumentNumberFromFilename(title);
    let documentNumber: string | null = null;
    if (detectedNumber) {
      const clash = await db.eDocFile.findFirst({ where: { documentNumber: detectedNumber, deletedAt: null }, select: { id: true, title: true } });
      if (clash) {
        return NextResponse.json({
          message: `Nomor dokumen "${detectedNumber}" (terdeteksi dari nama file) sudah dipakai file lain ("${clash.title}"). Cek apakah ini dobel di arsip — file ini TIDAK diupload.`,
        }, { status: 409 });
      }
      documentNumber = detectedNumber;
    }

    // Error dari langkah upload ke Nextcloud SENGAJA ditangkap terpisah dan pesannya
    // ditampilkan apa adanya ke client (bukan "Internal Server Error" generik seperti
    // catch-all di bawah) — uploadToNextcloud sudah menyertakan status HTTP + body respons
    // Nextcloud di pesan errornya (mis. 413 Payload Too Large), jadi kalau ada limit ukuran
    // file yang menolak (baik dari Nextcloud sendiri atau reverse proxy di depannya),
    // pesan itu langsung kelihatan di UI — tidak perlu menebak dari log server.
    let fileUrl: string;
    try {
      fileUrl = await uploadEDocFileToFolder(buffer, filename, folderId);
    } catch (e) {
      console.error("[edoc] bulk upload gagal upload ke Nextcloud", e);
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal upload ke Nextcloud" }, { status: 502 });
    }

    let created;
    try {
      created = await db.eDocFile.create({
        data: {
          folderId,
          title,
          categoryId,
          requiresNumber: false,
          status: "RELEASE",
          bulkImported: true,
          uploadedBy: userId,
          fileUrl,
          bulkUploadKey: idempotencyKey,
          documentNumber,
        },
      });
    } catch (e) {
      // Race amat sempit (dua request dengan key sama lolos cek "belum ada" di atas
      // sebelum salah satunya sempat INSERT) — @unique di bulkUploadKey menolak salah
      // satunya di sini. Alih-alih error ke user, ambil row yang menang dan kembalikan itu
      // — hasil akhirnya tetap "1 file, bukan dobel", persis tujuan idempotency key ini.
      if ((e as { code?: string }).code === "P2002" && idempotencyKey) {
        const existing = await db.eDocFile.findFirst({ where: { bulkUploadKey: idempotencyKey } });
        if (existing) return NextResponse.json({ data: existing, deduped: true }, { status: 200 });
      }
      throw e;
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
