import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";

const ENDPOINT = "/api/sso/login";

export async function POST(request: Request) {
  const start     = Date.now();
  const ip        = getClientIp(request);
  const userAgent = getUserAgent(request);

  function log(status: "SUCCESS" | "FAILED", opts: { appTokenId?: string | null; appName?: string | null; userId?: string | null; statusCode: number; reason?: string }) {
    writeApiLog({ method: "POST", endpoint: ENDPOINT, status, ip, userAgent, duration: Date.now() - start, ...opts });
  }

  try {
    const appToken = request.headers.get("x-app-token");
    if (!appToken) {
      log("FAILED", { statusCode: 401, reason: "X-App-Token header diperlukan" });
      return NextResponse.json({ error: "X-App-Token header diperlukan" }, { status: 401 });
    }

    const appRecord = await db.appToken.findUnique({
      where: { token: appToken },
      include: { module: { select: { name: true } } },
    });
    if (!appRecord || !appRecord.active || appRecord.deletedAt) {
      log("FAILED", { statusCode: 401, reason: "App token tidak valid atau tidak aktif" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const appName = appRecord.module?.name ?? appRecord.name;

    const body = await request.json().catch(() => ({}));
    const { employeeId, password } = body as { employeeId?: string; password?: string };

    if (!employeeId || !password) {
      log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 400, reason: "employeeId dan password wajib diisi" });
      return NextResponse.json({ error: "employeeId dan password wajib diisi" }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { employeeId } });
    if (!user || !user.password) {
      log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 401, reason: "Kredensial tidak valid" });
      return NextResponse.json({ error: "Kredensial tidak valid" }, { status: 401 });
    }

    if (user.resignDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const resignDay = new Date(user.resignDate); resignDay.setHours(0, 0, 0, 0);
      if (resignDay <= today) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: user.id, statusCode: 403, reason: "Akun tidak aktif (resign)" });
        return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
      }
    }
    if (user.status === "inactive") {
      log("FAILED", { appTokenId: appRecord.id, appName, userId: user.id, statusCode: 403, reason: "Akun tidak aktif" });
      return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      log("FAILED", { appTokenId: appRecord.id, appName, userId: user.id, statusCode: 401, reason: "Password salah" });
      return NextResponse.json({ error: "Kredensial tidak valid" }, { status: 401 });
    }

    await db.ssoSession.deleteMany({ where: { userId: user.id, appTokenId: appRecord.id } });

    const token = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.ssoSession.create({
      data: { userId: user.id, appTokenId: appRecord.id, token, expiresAt },
    });

    log("SUCCESS", { appTokenId: appRecord.id, appName, userId: user.id, statusCode: 200 });

    const { password: _, ...rest } = user as typeof user & { password?: string };
    return NextResponse.json({ token, expiresAt, user: rest });
  } catch (err) {
    console.error("[SSO Login]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
