import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// "Master Number" — admin bisa lihat & koreksi nilai counter terakhir langsung, supaya
// production bisa disesuaikan kapan pun ke kondisi berjalan (lihat catatan desain).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const counters = await db.eDocNumberSequenceCounter.findMany({ orderBy: [{ scope: "asc" }, { key: "asc" }] });
    return NextResponse.json({ data: counters });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const { scope, key, seq } = body as { scope?: string; key?: string; seq?: number };
    if (!scope || !key || typeof seq !== "number" || seq < 0) {
      return NextResponse.json({ message: "scope, key, dan seq (angka >= 0) wajib diisi" }, { status: 400 });
    }

    const counter = await db.eDocNumberSequenceCounter.upsert({
      where: { scope_key: { scope, key } },
      create: { scope, key, seq },
      update: { seq },
    });
    return NextResponse.json({ data: counter });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
