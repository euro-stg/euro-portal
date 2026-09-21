import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Watermark custom per Category — teks (mis. "APPROVED"), warna, dan posisi (mm dari
// pojok kiri-atas halaman A4), independen dari posisi Document Number/MOC Number.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    if (!categoryId) return NextResponse.json({ message: "categoryId wajib diisi" }, { status: 400 });

    const config = await db.eDocWatermarkConfig.findUnique({ where: { categoryId } });
    return NextResponse.json({ data: config });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const { categoryId, text, color, positionXMm, positionYMm, fontSize } = body as {
      categoryId?: string; text?: string; color?: string; positionXMm?: number; positionYMm?: number; fontSize?: number;
    };

    if (!categoryId) return NextResponse.json({ message: "categoryId wajib diisi" }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ message: "Teks watermark wajib diisi" }, { status: 400 });
    if (typeof positionXMm !== "number" || positionXMm < 0 || typeof positionYMm !== "number" || positionYMm < 0) {
      return NextResponse.json({ message: "Posisi X/Y (mm) wajib diisi, angka >= 0" }, { status: 400 });
    }

    const category = await db.eDocCategory.findFirst({ where: { id: categoryId, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    const config = await db.eDocWatermarkConfig.upsert({
      where: { categoryId },
      create: { categoryId, text: text.trim(), color: color?.trim() || "green", positionXMm, positionYMm, fontSize: fontSize ?? 24 },
      update: { text: text.trim(), color: color?.trim() || "green", positionXMm, positionYMm, fontSize: fontSize ?? 24 },
    });

    return NextResponse.json({ data: config });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
