import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";
import { verifyAppTokenJwt, hasPermission } from "@/lib/sso-jwt";

const ENDPOINT = "/api/sso/companies";

export async function GET(request: Request) {
  const start     = Date.now();
  const ip        = getClientIp(request);
  const userAgent = getUserAgent(request);

  function log(status: "SUCCESS" | "FAILED", opts: { appTokenId?: string | null; appName?: string | null; statusCode: number; reason?: string }) {
    writeApiLog({ method: "GET", endpoint: ENDPOINT, status, ip, userAgent, duration: Date.now() - start, ...opts });
  }

  try {
    const rawToken = request.headers.get("x-app-token");
    if (!rawToken) {
      log("FAILED", { statusCode: 401, reason: "X-App-Token header diperlukan" });
      return NextResponse.json({ error: "X-App-Token header diperlukan" }, { status: 401 });
    }

    const claims = await verifyAppTokenJwt(rawToken);
    if (!claims) {
      log("FAILED", { statusCode: 401, reason: "App token tidak valid" });
      return NextResponse.json({ error: "App token tidak valid" }, { status: 401 });
    }

    if (!hasPermission(claims.permissions, "GET_COMPANIES")) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 403, reason: "Tidak memiliki akses ke endpoint ini" });
      return NextResponse.json({ error: "Tidak memiliki akses ke endpoint ini" }, { status: 403 });
    }

    const appRecord = await db.appToken.findUnique({ where: { token: rawToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 401, reason: "App token tidak aktif atau sudah di-revoke" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const companies = await db.company.findMany({
      where: { deletedAt: null, status: "active" },
      orderBy: { order: "asc" },
      select: { id: true, code: true, name: true, order: true, status: true },
    });

    log("SUCCESS", { appTokenId: appRecord.id, appName: claims.name, statusCode: 200 });
    return NextResponse.json({ data: companies, total: companies.length });
  } catch (err) {
    console.error("[SSO Companies]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
