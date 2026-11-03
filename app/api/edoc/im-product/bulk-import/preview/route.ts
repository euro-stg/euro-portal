import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { parseImProductImport, isSuperadmin } from "@/lib/edoc";
import { buildBulkPreview } from "@/lib/im-bulk-import";

export const maxDuration = 120;

// Pratinjau "Cocokkan & Import Item" (2026-10-30) — TIDAK menulis apa pun: kelompokkan baris
// Excel per No. IM, cocokkan ke file IM (termasuk nomor dokumen yang akan diperbaiki saat
// import), cek SKU tiap baris ke Master Item. Khusus superadmin.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Cocokkan & Import Item hanya untuk superadmin" }, { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });

    let parsed;
    try {
      parsed = parseImProductImport(await file.arrayBuffer());
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
    }
    if ((await db.masterItem.count()) === 0) {
      return NextResponse.json({ message: "Master Item masih kosong — jalankan Sync ERP di Data Master → Master Item dulu" }, { status: 409 });
    }
    return NextResponse.json({ ...(await buildBulkPreview(parsed.products)), warnings: parsed.warnings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
