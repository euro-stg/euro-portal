import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { downloadEDocFile } from "@/lib/edoc";

// Download file Master Pricelist yang sudah diupload untuk 1 Business Unit — dipakai dari
// dua tempat: (1) tombol Download di Pengaturan (superadmin), (2) tombol "Download Pricelist"
// di halaman Import Item per file, murni acuan manual bagi user yang sedang mengisi template
// item (2026-09-29). Sengaja TIDAK superadmin-only seperti route GET/PUT lain di
// /api/edoc/im-pricelist — siapa pun yang login boleh download, karena ini cuma referensi
// harga per BU, bukan data sensitif yang perlu digating per folder ACL.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const businessUnitCode = searchParams.get("businessUnitCode");
    if (!businessUnitCode) return NextResponse.json({ message: "businessUnitCode wajib diisi" }, { status: 400 });

    const file = await db.eDocImPricelistFile.findUnique({ where: { businessUnitCode } });
    if (!file) return NextResponse.json({ message: "Belum ada file pricelist untuk Business Unit ini" }, { status: 404 });

    const nextcloudRes = await downloadEDocFile(file.fileUrl).catch(() => null);
    if (!nextcloudRes || !nextcloudRes.ok) {
      return NextResponse.json({ message: "File tidak ditemukan di storage" }, { status: 404 });
    }

    const buffer = await nextcloudRes.arrayBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/[^a-zA-Z0-9._ -]/g, "-")}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
