import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";

const ENDPOINT = "/api/sso/validate";

export async function GET(request: Request) {
  const start     = Date.now();
  const ip        = getClientIp(request);
  const userAgent = getUserAgent(request);

  function log(status: "SUCCESS" | "FAILED", opts: { appTokenId?: string | null; appName?: string | null; userId?: string | null; statusCode: number; reason?: string }) {
    writeApiLog({ method: "GET", endpoint: ENDPOINT, status, ip, userAgent, duration: Date.now() - start, ...opts });
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
      log("FAILED", { appTokenId: null, statusCode: 401, reason: "App token tidak valid atau tidak aktif" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const appName = appRecord.module?.name ?? appRecord.name;

    const { searchParams } = new URL(request.url);
    const ssoToken    = searchParams.get("sso_token");
    const authHeader  = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // ── Mode 1: sso_token dari redirect portal (single-use) ──
    if (ssoToken) {
      const redirectToken = await db.ssoRedirectToken.findUnique({
        where: { token: ssoToken },
        include: { user: true },
      });

      if (!redirectToken) {
        log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 401, reason: "SSO token tidak ditemukan" });
        return NextResponse.json({ valid: false, error: "SSO token tidak ditemukan" }, { status: 401 });
      }
      if (redirectToken.usedAt) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: redirectToken.userId, statusCode: 401, reason: "SSO token sudah digunakan" });
        return NextResponse.json({ valid: false, error: "SSO token sudah digunakan" }, { status: 401 });
      }
      if (redirectToken.expiresAt < new Date()) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: redirectToken.userId, statusCode: 401, reason: "SSO token sudah kadaluarsa" });
        return NextResponse.json({ valid: false, error: "SSO token sudah kadaluarsa (5 menit)" }, { status: 401 });
      }
      if (redirectToken.appTokenId !== appRecord.id) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: redirectToken.userId, statusCode: 403, reason: "SSO token bukan untuk app ini" });
        return NextResponse.json({ valid: false, error: "SSO token bukan untuk app ini" }, { status: 403 });
      }
      if (redirectToken.user.status === "inactive") {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: redirectToken.userId, statusCode: 403, reason: "Akun tidak aktif" });
        return NextResponse.json({ valid: false, error: "Akun tidak aktif" }, { status: 403 });
      }

      await db.ssoRedirectToken.update({ where: { id: redirectToken.id }, data: { usedAt: new Date() } });

      const sessionToken = (await import("crypto")).randomBytes(40).toString("hex");
      const expiresAt    = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.ssoSession.deleteMany({ where: { userId: redirectToken.userId, appTokenId: appRecord.id } });
      await db.ssoSession.create({
        data: { userId: redirectToken.userId, appTokenId: appRecord.id, token: sessionToken, expiresAt },
      });

      log("SUCCESS", { appTokenId: appRecord.id, appName, userId: redirectToken.userId, statusCode: 200 });

      const { password: _, ...userFields } = redirectToken.user as typeof redirectToken.user & { password?: string };
      return NextResponse.json({ valid: true, mode: "redirect", sessionToken, expiresAt, user: userFields });
    }

    // ── Mode 2: Bearer token dari login API ──
    if (bearerToken) {
      const session = await db.ssoSession.findUnique({
        where: { token: bearerToken },
        include: { user: true },
      });

      if (!session) {
        log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 401, reason: "Token tidak ditemukan" });
        return NextResponse.json({ valid: false, error: "Token tidak ditemukan" }, { status: 401 });
      }
      if (session.appTokenId !== appRecord.id) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: session.userId, statusCode: 403, reason: "Token bukan milik app ini" });
        return NextResponse.json({ valid: false, error: "Token bukan milik app ini" }, { status: 403 });
      }
      if (session.expiresAt < new Date()) {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: session.userId, statusCode: 401, reason: "Token sudah kadaluarsa" });
        return NextResponse.json({ valid: false, error: "Token sudah kadaluarsa" }, { status: 401 });
      }
      if (session.user.status === "inactive") {
        log("FAILED", { appTokenId: appRecord.id, appName, userId: session.userId, statusCode: 403, reason: "Akun tidak aktif" });
        return NextResponse.json({ valid: false, error: "Akun tidak aktif" }, { status: 403 });
      }

      log("SUCCESS", { appTokenId: appRecord.id, appName, userId: session.userId, statusCode: 200 });

      const { password: _, ...userFields } = session.user as typeof session.user & { password?: string };
      return NextResponse.json({ valid: true, mode: "session", expiresAt: session.expiresAt, user: userFields });
    }

    log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 400, reason: "sso_token atau Authorization header diperlukan" });
    return NextResponse.json({ error: "sso_token query param atau Authorization header diperlukan" }, { status: 400 });
  } catch (err) {
    console.error("[SSO Validate]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
