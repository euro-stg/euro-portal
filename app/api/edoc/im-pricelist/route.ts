import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, uploadEDocPricelistFile } from "@/lib/edoc";

// Master Pricelist Category IM — sekarang murni lampiran file per Business Unit (2026-09-29,
// tidak lagi diparsing jadi item terstruktur). Dikelola superadmin, konsisten dengan
// master-data lain di E Document (Category, Number Format, dst).
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const businessUnitCode = searchParams.get("businessUnitCode");
    if (!businessUnitCode) return NextResponse.json({ message: "businessUnitCode wajib diisi" }, { status: 400 });

    const file = await db.eDocImPricelistFile.findUnique({
      where: { businessUnitCode },
      include: { uploader: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ data: file });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Upload/ganti file Master Pricelist untuk 1 Business Unit — satu file per BU, upload ulang
// MENGGANTI file sebelumnya (bukan riwayat/versi). Tidak ada parsing/validasi isi Excel-nya
// sama sekali — murni disimpan sebagai lampiran, jadi acuan manual untuk user yang import item.
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;
    if (!(await isSuperadmin(userId))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const businessUnitCode = formData.get("businessUnitCode") as string | null;
    if (!file) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });
    if (!businessUnitCode) return NextResponse.json({ message: "businessUnitCode wajib diisi" }, { status: 400 });

    const bu = await db.eDocBusinessUnit.findFirst({ where: { code: businessUnitCode } });
    if (!bu) return NextResponse.json({ message: "Business Unit tidak ditemukan" }, { status: 404 });

    await uploadEDocPricelistFile(businessUnitCode, file.name, await file.arrayBuffer(), userId);

    return NextResponse.json({ message: "Berhasil diupload" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
