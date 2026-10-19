import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { writeApiLog, getClientIp, getUserAgent } from "@/lib/api-logger";
import { verifyAppTokenJwt, hasPermission } from "@/lib/sso-jwt";

const ENDPOINT = "/api/sso/organizations";

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

    if (!hasPermission(claims.permissions, "GET_ORGANIZATIONS")) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 403, reason: "Tidak memiliki akses ke endpoint ini" });
      return NextResponse.json({ error: "Tidak memiliki akses ke endpoint ini" }, { status: 403 });
    }

    const appRecord = await db.appToken.findUnique({ where: { token: rawToken } });
    if (!appRecord || !appRecord.active || appRecord.deletedAt) {
      log("FAILED", { appTokenId: claims.sub, appName: claims.name, statusCode: 401, reason: "App token tidak aktif atau sudah di-revoke" });
      return NextResponse.json({ error: "App token tidak valid atau tidak aktif" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search   = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const parentId = searchParams.get("parentId")?.trim() ?? "";

    // Respons BERTINGKAT (2026-10-19): sub-org ada di `children` induknya, bukan sejajar.
    // Field tiap node sama seperti sebelumnya (+ children). Organisasi yang parent-nya sudah
    // dihapus/tidak ada diperlakukan sebagai induk supaya tidak hilang.
    const all = await db.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, code: true, parentOrganizationId: true, source: true },
      orderBy: { name: "asc" },
    });
    const byId = new Map(all.map((o) => [o.id, o]));
    const parentOf = (o: (typeof all)[number]) =>
      o.parentOrganizationId && byId.has(o.parentOrganizationId) ? o.parentOrganizationId : null;

    // search → organisasi yang cocok + seluruh induknya (posisi di hierarki tetap terlihat).
    let included: Set<string> | null = null;
    if (search) {
      included = new Set();
      for (const o of all) {
        if (!o.name.toLowerCase().includes(search) && !(o.code ?? "").toLowerCase().includes(search)) continue;
        for (let cur: string | null = o.id; cur && !included.has(cur); cur = parentOf(byId.get(cur)!)) included.add(cur);
      }
    }

    type OrgNode = (typeof all)[number] & { children: OrgNode[] };
    const childrenOf = new Map<string | null, (typeof all)[number][]>();
    for (const o of all) {
      if (included && !included.has(o.id)) continue;
      const key = parentOf(o);
      childrenOf.set(key, [...(childrenOf.get(key) ?? []), o]);
    }
    const build = (o: (typeof all)[number], seen: Set<string>): OrgNode => ({
      ...o,
      // `seen` mencegah loop tak berujung kalau data parent saling menunjuk (data rusak).
      children: (childrenOf.get(o.id) ?? []).filter((c) => !seen.has(c.id)).map((c) => build(c, new Set([...seen, c.id]))),
    });

    // parentId=null (atau kosong) → mulai dari induk teratas; parentId=<id> → anak-anak org tsb.
    const rootKey = parentId && parentId !== "null" ? parentId : null;
    const data = (childrenOf.get(rootKey) ?? []).map((o) => build(o, new Set([o.id])));
    const countNodes = (nodes: OrgNode[]): number => nodes.reduce((n, x) => n + 1 + countNodes(x.children), 0);

    log("SUCCESS", { appTokenId: appRecord.id, appName: claims.name, statusCode: 200 });
    return NextResponse.json({ data, total: countNodes(data) });
  } catch (err) {
    console.error("[SSO Organizations]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
