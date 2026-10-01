import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { isSuperadmin, isEDocFolderCreator, isEDocDocumentApprover, getUserBusinessUnits, relocateExpiredFiles } from "@/lib/edoc";

// Dipanggil sekali tiap kali halaman E Document dibuka — tempat paling reliable untuk
// memicu relocateExpiredFiles (2026-10-01, lihat catatan di definisinya: dulu dipicu per-
// folder saat folder itu sendiri di-browse, tapi filter visibility yang menyembunyikan
// file expired dari listing-nya SENDIRI juga menghilangkan alasan siapapun membuka folder
// itu lagi — jadi bisa macet permanen, ditemukan 6 file nyata macet di production).
// Throttle in-memory 5 menit — endpoint ini kepanggil sering (tiap buka halaman), tidak
// perlu jalankan UPDATE ini di setiap pemanggilan.
let lastRelocateRun = 0;
const RELOCATE_THROTTLE_MS = 5 * 60_000;

// Profil ringkas user untuk kebutuhan UI E Document: business unit hasil hitung dari
// branchName, dan role flags (Folder Creator / Document Approver / superadmin).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    if (Date.now() - lastRelocateRun > RELOCATE_THROTTLE_MS) {
      lastRelocateRun = Date.now();
      await relocateExpiredFiles().catch((e) => console.error("[edoc] relocateExpiredFiles gagal", e));
    }

    const [superadmin, folderCreator, documentApprover, businessUnits] = await Promise.all([
      isSuperadmin(userId),
      isEDocFolderCreator(userId),
      isEDocDocumentApprover(userId),
      getUserBusinessUnits(userId),
    ]);

    return NextResponse.json({
      userId,
      isSuperadmin: superadmin,
      isFolderCreator: superadmin || folderCreator,
      isDocumentApprover: superadmin || documentApprover,
      businessUnits,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
