import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";
import { verifyAppTokenJwt, hasPermission } from "@/lib/sso-jwt";

const ENDPOINT = "/api/sso/login";

export async function POST(request: Request) {
  const start     = Date.now();
  const ip        = getClientIp(request);
  const userAgent = getUserAgent(request);

  function log(status: "SUCCESS" | "FAILED", opts: { appTokenId?: string | null; appName?: string | null; userId?: string | null; statusCode: number; reason?: string }) {
    writeApiLog({ method: "POST", endpoint: ENDPOINT, status, ip, userAgent, duration: Date.now() - start, ...opts });
  }

  try {
    const rawToken = request.headers.get("x-app-token");
    if (!rawToken) {
      log("FAILED", { statusCode: 401, reason: "X-App-Token header diperlukan" });
      return NextResponse.json({ error: "X-App-Token header diperlukan" }, { status: 401 });
    }

    // Verify JWT
    const claims = await verifyAppTokenJwt(rawToken);
    if (!claims) {
      log("FAILED", { statusCode: 401, reason: "App token tidak valid" });
      return NextResponse.json({ error: "App token tidak valid" }, { status: 401 });
    }

    // Check permission
    if (!hasPermission(claims.permissions, "LOGIN")) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 403, reason: "Tidak memiliki akses ke endpoint ini" });
      return NextResponse.json({ error: "Tidak memiliki akses ke endpoint ini" }, { status: 403 });
    }

    // Lookup app record — cek active & tidak di-delete, sekaligus revocation check
    const appRecord = await db.appToken.findUnique({ where: { token: rawToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 401, reason: "App token tidak aktif atau sudah di-revoke" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const appName = claims.name;

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

    // Cek akses user ke app ini (via UserRole.appId = AppToken.moduleId)
    if (appRecord.moduleId) {
      const hasAccess = await db.userRole.findFirst({
        where: { userId: user.id, appId: appRecord.moduleId },
      });
      if (!hasAccess) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: user.id, statusCode: 403, reason: "User tidak memiliki akses ke aplikasi ini" });
        return NextResponse.json({ error: "Anda tidak memiliki akses ke aplikasi ini" }, { status: 403 });
      }
    }

    await db.ssoSession.deleteMany({ where: { userId: user.id, appTokenId: appRecord.id } });

    const { randomBytes } = await import("crypto");
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
