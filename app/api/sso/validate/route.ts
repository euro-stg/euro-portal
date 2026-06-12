import { NextResponse } from "next/server";
import db from "@/lib/db/db";

function getClientInfo(request: Request) {
  const ip        = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? request.headers.get("x-real-ip")
                 ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function writeLog(data: {
  appTokenId: string | null;
  userId: string | null;
  event: string;
  status: "SUCCESS" | "FAILED";
  reason?: string;
  mode?: string;
  ip: string | null;
  userAgent: string | null;
}) {
  await db.ssoActivityLog.create({ data }).catch(() => {}); // fire-and-forget, jangan gagalkan request
}

// Support 2 mode:
// 1. sso_token (query param) — dari redirect portal, single-use, 5 menit
// 2. Authorization: Bearer <token> — dari login API, 24 jam, bisa dipakai berulang
export async function GET(request: Request) {
  const { ip, userAgent } = getClientInfo(request);

  try {
    const appToken = request.headers.get("x-app-token");
    if (!appToken) return NextResponse.json({ error: "X-App-Token header diperlukan" }, { status: 401 });

    const appRecord = await db.appToken.findUnique({ where: { token: appToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt) {
      await writeLog({ appTokenId: null, userId: null, event: "SSO_VALIDATE", status: "FAILED", reason: "App token tidak valid atau tidak aktif", ip, userAgent });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

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
        await writeLog({ appTokenId: appRecord.id, userId: null, event: "SSO_VALIDATE_REDIRECT", status: "FAILED", reason: "SSO token tidak ditemukan", mode: "redirect", ip, userAgent });
        return NextResponse.json({ valid: false, error: "SSO token tidak ditemukan" }, { status: 401 });
      }
      if (redirectToken.usedAt) {
        await writeLog({ appTokenId: appRecord.id, userId: redirectToken.userId, event: "SSO_VALIDATE_REDIRECT", status: "FAILED", reason: "SSO token sudah digunakan", mode: "redirect", ip, userAgent });
        return NextResponse.json({ valid: false, error: "SSO token sudah digunakan" }, { status: 401 });
      }
      if (redirectToken.expiresAt < new Date()) {
        await writeLog({ appTokenId: appRecord.id, userId: redirectToken.userId, event: "SSO_VALIDATE_REDIRECT", status: "FAILED", reason: "SSO token sudah kadaluarsa", mode: "redirect", ip, userAgent });
        return NextResponse.json({ valid: false, error: "SSO token sudah kadaluarsa (5 menit)" }, { status: 401 });
      }
      if (redirectToken.appTokenId !== appRecord.id) {
        await writeLog({ appTokenId: appRecord.id, userId: redirectToken.userId, event: "SSO_VALIDATE_REDIRECT", status: "FAILED", reason: "SSO token bukan untuk app ini", mode: "redirect", ip, userAgent });
        return NextResponse.json({ valid: false, error: "SSO token bukan untuk app ini" }, { status: 403 });
      }
      if (redirectToken.user.status === "inactive") {
        await writeLog({ appTokenId: appRecord.id, userId: redirectToken.userId, event: "SSO_VALIDATE_REDIRECT", status: "FAILED", reason: "Akun tidak aktif", mode: "redirect", ip, userAgent });
        return NextResponse.json({ valid: false, error: "Akun tidak aktif" }, { status: 403 });
      }

      await db.ssoRedirectToken.update({ where: { id: redirectToken.id }, data: { usedAt: new Date() } });

      const sessionToken = (await import("crypto")).randomBytes(40).toString("hex");
      const expiresAt    = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.ssoSession.deleteMany({ where: { userId: redirectToken.userId, appTokenId: appRecord.id } });
      await db.ssoSession.create({
        data: { userId: redirectToken.userId, appTokenId: appRecord.id, token: sessionToken, expiresAt },
      });

      await writeLog({ appTokenId: appRecord.id, userId: redirectToken.userId, event: "SSO_VALIDATE_REDIRECT", status: "SUCCESS", mode: "redirect", ip, userAgent });

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
        await writeLog({ appTokenId: appRecord.id, userId: null, event: "SSO_VALIDATE_SESSION", status: "FAILED", reason: "Token tidak ditemukan", mode: "session", ip, userAgent });
        return NextResponse.json({ valid: false, error: "Token tidak ditemukan" }, { status: 401 });
      }
      if (session.appTokenId !== appRecord.id) {
        await writeLog({ appTokenId: appRecord.id, userId: session.userId, event: "SSO_VALIDATE_SESSION", status: "FAILED", reason: "Token bukan milik app ini", mode: "session", ip, userAgent });
        return NextResponse.json({ valid: false, error: "Token bukan milik app ini" }, { status: 403 });
      }
      if (session.expiresAt < new Date()) {
        await writeLog({ appTokenId: appRecord.id, userId: session.userId, event: "SSO_VALIDATE_SESSION", status: "FAILED", reason: "Token sudah kadaluarsa", mode: "session", ip, userAgent });
        return NextResponse.json({ valid: false, error: "Token sudah kadaluarsa" }, { status: 401 });
      }
      if (session.user.status === "inactive") {
        await writeLog({ appTokenId: appRecord.id, userId: session.userId, event: "SSO_VALIDATE_SESSION", status: "FAILED", reason: "Akun tidak aktif", mode: "session", ip, userAgent });
        return NextResponse.json({ valid: false, error: "Akun tidak aktif" }, { status: 403 });
      }

      await writeLog({ appTokenId: appRecord.id, userId: session.userId, event: "SSO_VALIDATE_SESSION", status: "SUCCESS", mode: "session", ip, userAgent });

      const { password: _, ...userFields } = session.user as typeof session.user & { password?: string };

      return NextResponse.json({ valid: true, mode: "session", expiresAt: session.expiresAt, user: userFields });
    }

    return NextResponse.json({ error: "sso_token query param atau Authorization header diperlukan" }, { status: 400 });
  } catch (err) {
    console.error("[SSO Validate]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
