import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

// Lookup dua arah, dari satu tabel yang sama:
//   ?itemName=xxx -> item ini terkait file IM mana saja (hanya file yang masih "aktif")
//   ?fileId=xxx   -> file IM ini terkait item/promo apa saja
// "Aktif" = status RELEASE, belum expired, belum masuk folder Obsolete (asumsi, lihat
// catatan desain — belum eksplisit dikonfirmasi user).
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get("itemName");
    const fileId = searchParams.get("fileId");

    if (fileId) {
      const products = await db.eDocImProduct.findMany({ where: { fileId }, orderBy: { itemName: "asc" } });
      return NextResponse.json({ data: products });
    }

    if (itemName) {
      const products = await db.eDocImProduct.findMany({
        where: {
          itemName: { contains: itemName, mode: "insensitive" },
          file: {
            deletedAt: null,
            status: "RELEASE",
            OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
            folder: { type: { not: "OBSOLETE" } },
          },
        },
        include: {
          file: {
            select: { id: true, title: true, documentNumber: true, folderId: true, category: { select: { code: true, name: true } } },
          },
        },
        orderBy: { itemName: "asc" },
      });
      return NextResponse.json({ data: products });
    }

    return NextResponse.json({ message: "itemName atau fileId wajib diisi" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
