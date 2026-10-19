import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";
import { verifyAppTokenJwt, hasPermission } from "@/lib/sso-jwt";

const ENDPOINT = "/api/sso/edoc/im";

// Daftar Internal Memo (E Document kategori IM) untuk aplikasi eksternal (2026-10-19).
// Hanya dokumen RELEASE yang sudah punya nomor. Tanpa isi PDF / email — cuma metadata.
// Query: year, department (kode organisasi, mis. BUS), search (nomor/judul), updatedSince
// (ISO datetime, untuk sync bertahap), page, limit (maks 100).
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

    if (!hasPermission(claims.permissions, "GET_EDOC_IM")) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 403, reason: "Tidak memiliki akses ke endpoint ini" });
      return NextResponse.json({ error: "Tidak memiliki akses ke endpoint ini" }, { status: 403 });
    }

    const appRecord = await db.appToken.findUnique({ where: { token: rawToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 401, reason: "App token tidak aktif atau sudah di-revoke" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const appName = claims.name;
    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1") || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20") || 20));
    const search = searchParams.get("search")?.trim() ?? "";
    const year   = searchParams.get("year")?.trim() ?? "";
    const department = searchParams.get("department")?.trim() ?? "";
    const updatedSinceRaw = searchParams.get("updatedSince")?.trim() ?? "";
    const updatedSince = updatedSinceRaw ? new Date(updatedSinceRaw) : null;
    if (year && !/^\d{4}$/.test(year)) {
      log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 400, reason: "year tidak valid" });
      return NextResponse.json({ error: "Parameter year harus 4 digit, mis. 2025" }, { status: 400 });
    }
    if (updatedSince && isNaN(updatedSince.getTime())) {
      log("FAILED", { appTokenId: appRecord.id, appName, statusCode: 400, reason: "updatedSince tidak valid" });
      return NextResponse.json({ error: "Parameter updatedSince harus format tanggal ISO, mis. 2026-10-01T00:00:00Z" }, { status: 400 });
    }

    const orgIds = department
      ? (await db.organization.findMany({ where: { code: { equals: department, mode: "insensitive" }, deletedAt: null }, select: { id: true } })).map((o) => o.id)
      : null;

    const where = {
      deletedAt: null,
      status: "RELEASE",
      documentNumber: { not: null },
      category: { code: "IM" },
      ...(year ? { documentNumber: { not: null, endsWith: `/${year}` } } : {}),
      ...(orgIds ? { organizationId: { in: orgIds } } : {}),
      ...(updatedSince ? { updatedAt: { gte: updatedSince } } : {}),
      ...(search ? {
        OR: [
          { documentNumber: { contains: search, mode: "insensitive" as const } },
          { title:          { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [files, total] = await Promise.all([
      db.eDocFile.findMany({
        where,
        select: {
          id: true, documentNumber: true, title: true, status: true, validityType: true,
          startDate: true, endDate: true, approvedAt: true, updatedAt: true, organizationId: true,
          initiatorJobPositionName: true,
          categoryType: { select: { code: true, name: true } },
          initiator: { select: { employeeId: true, name: true } },
        },
        orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.eDocFile.count({ where }),
    ]);

    const orgs = await db.organization.findMany({
      where: { id: { in: [...new Set(files.map((f) => f.organizationId).filter((v): v is string => !!v))] } },
      select: { id: true, code: true, name: true },
    });
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const data = files.map((f) => {
      // Nomor urut = angka pertama di nomor dokumen, tahun = segmen 4 digit terakhir.
      // Mis. "004/Euromedica/IM/BUS/XII/2025" → "004" & 2025 → yearFormat "004 - 2025".
      const seq = f.documentNumber?.match(/\d+/)?.[0] ?? null;
      const yr = f.documentNumber?.match(/(\d{4})\s*$/)?.[1] ?? null;
      const org = f.organizationId ? orgById.get(f.organizationId) : undefined;
      return {
        id: f.id,
        documentNumber: f.documentNumber,
        sequence: seq ? Number(seq) : null,
        year: yr ? Number(yr) : null,
        yearFormat: seq && yr ? `${seq} - ${yr}` : null,
        title: f.title,
        categoryType: f.categoryType ? { code: f.categoryType.code, name: f.categoryType.name } : null,
        initiator: f.initiator
          ? { employeeId: f.initiator.employeeId, name: f.initiator.name, jobPosition: f.initiatorJobPositionName }
          : null,
        validity: f.validityType,
        startDate: f.startDate,
        endDate: f.endDate,
        department: org ? { code: org.code, name: org.name } : null,
        status: f.status,
        approvedAt: f.approvedAt,
        updatedAt: f.updatedAt,
      };
    });

    log("SUCCESS", { appTokenId: appRecord.id, appName, statusCode: 200 });
    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[SSO EDoc IM]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
