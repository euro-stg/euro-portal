import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const status = searchParams.get("status") ?? "";
    const source = searchParams.get("source") ?? "";
    const from   = searchParams.get("from")   ?? "";
    const to     = searchParams.get("to")     ?? "";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      db.emailLog.count({ where }),
      db.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, to: true, subject: true, source: true, status: true, error: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { before } = body as { before?: string };

    if (!before) return NextResponse.json({ message: "Parameter 'before' wajib diisi (YYYY-MM-DD)" }, { status: 400 });

    const cutoff = new Date(before);
    cutoff.setHours(23, 59, 59, 999);

    if (isNaN(cutoff.getTime())) return NextResponse.json({ message: "Format tanggal tidak valid" }, { status: 400 });

    const { count } = await db.emailLog.deleteMany({ where: { createdAt: { lte: cutoff } } });

    return NextResponse.json({ message: `${count} log berhasil dihapus`, count });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
