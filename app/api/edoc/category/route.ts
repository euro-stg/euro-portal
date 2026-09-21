import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Master data Category — admin-configurable, superadmin-only (asumsi konsisten dengan
// master data E Document lainnya, belum eksplisit dikonfirmasi user).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const categories = await db.eDocCategory.findMany({
      where: { deletedAt: null },
      include: { categoryTypes: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: categories });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!code || !name) return NextResponse.json({ message: "Code dan name wajib diisi" }, { status: 400 });

    let category;
    try {
      category = await db.eDocCategory.create({ data: { code, name } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ message: "Code sudah dipakai" }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
