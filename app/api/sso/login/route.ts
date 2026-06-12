import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import db from "@/lib/db/db";

export async function POST(request: Request) {
  try {
    const appToken = request.headers.get("x-app-token");
    if (!appToken) return NextResponse.json({ error: "X-App-Token header diperlukan" }, { status: 401 });

    const appRecord = await db.appToken.findUnique({ where: { token: appToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt)
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { employeeId, password } = body as { employeeId?: string; password?: string };

    if (!employeeId || !password)
      return NextResponse.json({ error: "employeeId dan password wajib diisi" }, { status: 400 });

    const user = await db.user.findFirst({ where: { employeeId } });
    if (!user || !user.password)
      return NextResponse.json({ error: "Kredensial tidak valid" }, { status: 401 });

    // Cek resign date dan status
    if (user.resignDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const resignDay = new Date(user.resignDate); resignDay.setHours(0, 0, 0, 0);
      if (resignDay <= today) return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
    }
    if (user.status === "inactive") return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return NextResponse.json({ error: "Kredensial tidak valid" }, { status: 401 });

    // Hapus session lama dari app yang sama untuk user ini
    await db.ssoSession.deleteMany({ where: { userId: user.id, appTokenId: appRecord.id } });

    // Buat session baru — 24 jam
    const token = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.ssoSession.create({
      data: { userId: user.id, appTokenId: appRecord.id, token, expiresAt },
    });

    return NextResponse.json({
      token,
      expiresAt,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("[SSO Login]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function sanitizeUser(user: Record<string, unknown>) {
  const { password: _, ...rest } = user as { password?: string } & Record<string, unknown>;
  return rest;
}
