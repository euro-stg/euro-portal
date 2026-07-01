import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { ssdLetterScopeFilter } from "@/lib/ssd";

const PAGE_SIZE = 15;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const mine   = searchParams.get("mine") === "true";
    const catId  = searchParams.get("categoryId")?.trim();
    const deptId = searchParams.get("departmentId")?.trim();
    const compId = searchParams.get("companyId")?.trim();

    const scopeFilter = await ssdLetterScopeFilter(userId);

    const where = {
      deletedAt: null,
      ...scopeFilter,
      ...(mine ? { requestedBy: userId } : {}),
      ...(search ? { OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { letterNo: { contains: search, mode: "insensitive" as const } },
      ]} : {}),
      ...(status  ? { status }      : {}),
      ...(catId   ? { categoryId: catId }   : {}),
      ...(deptId  ? { departmentId: deptId } : {}),
      ...(compId  ? { companyId: compId }   : {}),
    };

    const [rows, total] = await Promise.all([
      db.ssdLetter.findMany({
        where,
        select: {
          id: true, letterNo: true, title: true, tujuan: true, status: true,
          fileDraft: true, fileFinal: true, createdAt: true, updatedAt: true,
          category: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          company: { select: { id: true, code: true, name: true } },
          requester: { select: { id: true, name: true, jobPositionName: true } },
          pic: { select: { id: true, name: true } },
          approval: { select: { id: true, status: true, currentStep: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.ssdLetter.count({ where }),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { title, tujuan, picId, categoryId, departmentId, companyId, fileDraft } = body as {
      title?: string; tujuan?: string; picId?: string;
      categoryId?: string; departmentId?: string; companyId?: string;
      fileDraft?: string;
    };

    if (!title?.trim())    return NextResponse.json({ message: "Perihal wajib diisi" }, { status: 400 });
    if (!categoryId)       return NextResponse.json({ message: "Kategori wajib dipilih" }, { status: 400 });
    if (!departmentId)     return NextResponse.json({ message: "Departemen wajib dipilih" }, { status: 400 });
    if (!companyId)        return NextResponse.json({ message: "Perusahaan wajib dipilih" }, { status: 400 });

    const category = await db.ssdCategory.findUnique({ where: { id: categoryId } });
    if (!category) return NextResponse.json({ message: "Kategori tidak ditemukan" }, { status: 404 });
    if (category.hasDraft && !fileDraft)
      return NextResponse.json({ message: "File draft wajib diupload untuk kategori ini" }, { status: 400 });

    const letter = await db.ssdLetter.create({
      data: {
        title: title.trim(),
        tujuan: tujuan?.trim() || null,
        picId: picId || null,
        categoryId,
        departmentId,
        companyId,
        requestedBy: session.user.id,
        fileDraft: fileDraft ?? null,
        status: "DRAFT",
      },
    });

    await db.ssdActivity.create({
      data: { letterId: letter.id, userId: session.user.id, action: "CREATED", note: "Surat dibuat" },
    });

    return NextResponse.json({ data: letter }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
