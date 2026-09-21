import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

const VALID_TYPES = ["DOCUMENT_NUMBER", "MOC_NUMBER"];
const VALID_SEGMENT_TYPES = [
  "LITERAL_TEXT", "SEQUENCE", "CATEGORY_CODE", "CATEGORY_TYPE_CODE",
  "ORG_DEPT_CODE", "MONTH_ROMAN", "YEAR", "REF_MAIN_DOCUMENT_NUMBER",
];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const type = searchParams.get("type");
    if (!categoryId || !type) return NextResponse.json({ message: "categoryId dan type wajib diisi" }, { status: 400 });

    const format = await db.eDocNumberFormat.findUnique({
      where: { categoryId_type: { categoryId, type } },
      include: { segments: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ data: format });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Full-replace: menghapus & bikin ulang seluruh segment list-nya. Lebih sederhana daripada
// CRUD granular per segment, dan cocok untuk UI segment-builder yang submit sekaligus.
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const { categoryId, type, sequenceScope, segments, positionXMm, positionYMm, fontSize } = body as {
      categoryId?: string; type?: string; sequenceScope?: string;
      segments?: { segmentType: string; literalValue?: string; separatorAfter?: string }[];
      positionXMm?: number; positionYMm?: number; fontSize?: number;
    };

    if (!categoryId || !type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ message: "categoryId dan type (DOCUMENT_NUMBER/MOC_NUMBER) wajib diisi" }, { status: 400 });
    }
    if (sequenceScope && !["GLOBAL", "PER_CATEGORY"].includes(sequenceScope)) {
      return NextResponse.json({ message: "sequenceScope tidak valid" }, { status: 400 });
    }
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ message: "Minimal 1 segment" }, { status: 400 });
    }
    if (positionXMm !== undefined && (typeof positionXMm !== "number" || positionXMm < 0)) {
      return NextResponse.json({ message: "positionXMm harus angka >= 0" }, { status: 400 });
    }
    if (positionYMm !== undefined && (typeof positionYMm !== "number" || positionYMm < 0)) {
      return NextResponse.json({ message: "positionYMm harus angka >= 0" }, { status: 400 });
    }
    for (const s of segments) {
      if (!VALID_SEGMENT_TYPES.includes(s.segmentType)) {
        return NextResponse.json({ message: `segmentType tidak valid: ${s.segmentType}` }, { status: 400 });
      }
      if (s.segmentType === "LITERAL_TEXT" && !s.literalValue?.trim()) {
        return NextResponse.json({ message: "Segment LITERAL_TEXT wajib punya literalValue" }, { status: 400 });
      }
    }

    const category = await db.eDocCategory.findFirst({ where: { id: categoryId, deletedAt: null } });
    if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });

    const format = await db.$transaction(async (tx) => {
      const f = await tx.eDocNumberFormat.upsert({
        where: { categoryId_type: { categoryId, type } },
        create: {
          categoryId, type, sequenceScope: sequenceScope ?? "GLOBAL",
          positionXMm: positionXMm ?? null, positionYMm: positionYMm ?? null, fontSize: fontSize ?? 11,
        },
        update: {
          sequenceScope: sequenceScope ?? "GLOBAL",
          positionXMm: positionXMm ?? null, positionYMm: positionYMm ?? null, fontSize: fontSize ?? 11,
        },
      });
      await tx.eDocNumberFormatSegment.deleteMany({ where: { numberFormatId: f.id } });
      await tx.eDocNumberFormatSegment.createMany({
        data: segments.map((s, i) => ({
          numberFormatId: f.id, order: i, segmentType: s.segmentType,
          literalValue: s.segmentType === "LITERAL_TEXT" ? s.literalValue!.trim() : null,
          separatorAfter: s.separatorAfter ?? "/",
        })),
      });
      return tx.eDocNumberFormat.findUnique({ where: { id: f.id }, include: { segments: { orderBy: { order: "asc" } } } });
    });

    return NextResponse.json({ data: format });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
