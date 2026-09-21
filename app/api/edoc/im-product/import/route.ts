import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canEditFileMetadata, parseImProductImport } from "@/lib/edoc";

// Hardcoded khusus Category IM (code === "IM") — bukan kemampuan generic per-category.
// Akses: uploader file itu sendiri, atau superadmin (pola sama seperti Feedback).
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const formData = await request.formData();
    const fileId = formData.get("fileId") as string | null;
    const file = formData.get("file") as File | null;
    if (!fileId) return NextResponse.json({ message: "fileId wajib diisi" }, { status: 400 });
    if (!file) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });

    const edocFile = await db.eDocFile.findFirst({
      where: { id: fileId, deletedAt: null },
      include: { category: { select: { code: true } } },
    });
    if (!edocFile) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (edocFile.category.code !== "IM") {
      return NextResponse.json({ message: "Lampiran produk/SKU hanya berlaku untuk file Category IM" }, { status: 400 });
    }

    // Sama seperti PATCH /api/edoc/file/[id] (edit metadata) — superadmin, Folder Creator
    // manapun kalau file ini hasil Bulk Import, atau uploader-nya sendiri selagi
    // requiresNumber=false (2026-09-21, disatukan supaya dua jalur "lengkapi data file
    // Bulk Import" ini tidak drift beda aturan).
    if (!(await canEditFileMetadata(userId, edocFile))) {
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk import data produk ke file ini" }, { status: 403 });
    }

    let products, warnings;
    try {
      ({ products, warnings } = parseImProductImport(await file.arrayBuffer(), edocFile.documentNumber));
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
    }

    const created = await db.$transaction(
      products.map((p) =>
        db.eDocImProduct.create({
          data: {
            fileId,
            itemName: p.itemName,
            sku: p.sku,
            category: p.category,
            discountClass: p.discountClass,
            normalPrice: p.normalPrice,
            promoType: p.promoType,
            promoDetail: p.promoDetail,
            promoPrice: p.promoPrice,
            discountPercent: p.discountPercent,
            qty: p.qty,
            imNumber: p.imNumber,
            imSubject: p.imSubject,
            validity: p.validity,
            eligibleClient: p.eligibleClient,
            keyConditions: p.keyConditions,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extra: p.extra as any,
            importedBy: userId,
          },
        })
      )
    );

    return NextResponse.json({ data: created, imported: created.length, warnings }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
