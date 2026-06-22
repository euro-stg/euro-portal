import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";

const ENDPOINT = "/api/sso/users";

export async function GET(request: Request) {
  const start     = Date.now();
  const ip        = getClientIp(request);
  const userAgent = getUserAgent(request);

  function log(status: "SUCCESS" | "FAILED", opts: { appTokenId?: string | null; appName?: string | null; statusCode: number; reason?: string }) {
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
      log("FAILED", { statusCode: 401, reason: "App token tidak valid atau tidak aktif" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const appName = appRecord.module?.name ?? appRecord.name;

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")   ?? "1"));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const search = searchParams.get("search")?.trim() ?? "";
    const skip   = (page - 1) * limit;

    const where = {
      status: "active" as const,
      ...(search ? {
        OR: [
          { name:             { contains: search, mode: "insensitive" as const } },
          { employeeId:       { contains: search, mode: "insensitive" as const } },
          { email:            { contains: search, mode: "insensitive" as const } },
          { jobPositionName:  { contains: search, mode: "insensitive" as const } },
          { organizationName: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, employeeId: true, name: true, email: true, phone: true,
          jobPositionId: true, jobPositionName: true,
          organizationId: true, organizationName: true,
          branchId: true, branchName: true,
          age: true, joinDate: true, resignDate: true,
          status: true, image: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    log("SUCCESS", { appTokenId: appRecord.id, appName, statusCode: 200 });
    return NextResponse.json({ data: users, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[SSO Users]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
