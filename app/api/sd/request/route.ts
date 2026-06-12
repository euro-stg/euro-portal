import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const type   = searchParams.get("type")?.trim();
    const mine   = searchParams.get("mine") === "true";

    const where = {
      deletedAt: null,
      ...(mine ? { requestedBy: session.user.id } : {}),
      ...(search ? { OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { requestNo: { contains: search, mode: "insensitive" as const } },
      ]} : {}),
      ...(status ? { status } : {}),
      ...(type   ? { type }   : {}),
    };

    const [rows, total] = await Promise.all([
      db.sdRequest.findMany({
        where,
        select: {
          id: true, requestNo: true, type: true, title: true, status: true,
          estimatedCompletedAt: true, createdAt: true,
          requester: { select: { id: true, name: true, jobPositionName: true } },
          pic: { select: { id: true, name: true } },
          refApp: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.sdRequest.count({ where }),
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
    const { title, description, type, refAppId, estimatedCompletedAt } = body as {
      title?: string; description?: string; type?: string;
      refAppId?: string; estimatedCompletedAt?: string;
    };

    if (!title?.trim())       return NextResponse.json({ message: "Judul wajib diisi" }, { status: 400 });
    if (!description?.trim()) return NextResponse.json({ message: "Deskripsi wajib diisi" }, { status: 400 });
    if (!type?.trim())        return NextResponse.json({ message: "Tipe wajib dipilih" }, { status: 400 });

    // Generate requestNo: SD-YYYY-NNN
    const year = new Date().getFullYear();
    const prefix = `SD-${year}-`;
    const last = await db.sdRequest.findFirst({
      where: { requestNo: { startsWith: prefix } },
      orderBy: { requestNo: "desc" },
      select: { requestNo: true },
    });
    const seq = last ? Number(last.requestNo.split("-")[2]) + 1 : 1;
    const requestNo = `${prefix}${String(seq).padStart(3, "0")}`;

    const req = await db.sdRequest.create({
      data: {
        requestNo,
        type,
        title: title.trim(),
        description: description.trim(),
        requestedBy: session.user.id,
        refAppId: refAppId || null,
        estimatedCompletedAt: estimatedCompletedAt ? new Date(estimatedCompletedAt) : null,
        status: "DRAFT",
      },
    });

    await db.sdActivity.create({
      data: { requestId: req.id, userId: session.user.id, action: "CREATED", note: "Pengajuan dibuat" },
    });

    return NextResponse.json({ data: req }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
