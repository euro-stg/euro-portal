import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, parseImPricelistImport } from "@/lib/edoc";

// Master Pricelist Category IM — dikelola superadmin, sumber "Pricelist" tab yang dibundel
// ke template download (lihat generateImProductTemplate). Superadmin-only, konsisten dengan
// master-data lain di E Document (Category, Number Format, dst).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const items = await db.eDocImPricelistItem.findMany({ orderBy: { itemName: "asc" } });
    return NextResponse.json({ data: items });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Import Excel (sheet "Pricelist", atau sheet pertama) — upsert by itemName, jadi
// re-import file yang sama/lebih baru meng-update baris yang sudah ada, bukan menduplikasi.
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;
    if (!(await isSuperadmin(userId))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });

    let items;
    try {
      items = parseImPricelistImport(await file.arrayBuffer());
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
    }

    await db.$transaction(
      items.map((p) =>
        db.eDocImPricelistItem.upsert({
          where: { itemName: p.itemName },
          create: {
            itemName: p.itemName, category: p.category, discountClass: p.discountClass,
            packaging: p.packaging, normalPrice: p.normalPrice, notes: p.notes, updatedBy: userId,
          },
          update: {
            category: p.category, discountClass: p.discountClass,
            packaging: p.packaging, normalPrice: p.normalPrice, notes: p.notes, updatedBy: userId,
          },
        })
      )
    );

    return NextResponse.json({ imported: items.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
