import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { getLastMasterItemSync, MASTER_ITEM_GROUPS } from "@/lib/master-item-sync";
import { buildMasterItemWhere } from "@/lib/master-item-query";

// Daftar Master Item (2026-10-28) — cukup login: dibaca juga oleh E Document (validasi item IM).
// Query: filter di buildMasterItemWhere (app/lib/master-item-query.ts) + page, limit (maks 100).
export async function GET(request: Request) {
  try {
    if (!(await requireSession())) return unauthorized();
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 20) || 20));
    const where = buildMasterItemWhere(sp);
    const [rows, total, byStatus, lastSync, companies, businesses] = await Promise.all([
      db.masterItem.findMany({ where, orderBy: [{ status: "asc" }, { itemName: "asc" }], skip: (page - 1) * limit, take: limit }),
      db.masterItem.count({ where }),
      db.masterItem.groupBy({ by: ["status"], _count: { _all: true } }),
      getLastMasterItemSync(),
      db.masterItem.findMany({ where: { company: { not: null } }, distinct: ["company"], select: { company: true }, orderBy: { company: "asc" } }),
      db.masterItem.findMany({ where: { business: { not: null } }, distinct: ["business"], select: { business: true }, orderBy: { business: "asc" } }),
    ]);
    const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
    return NextResponse.json({
      data: rows, total, page, totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: { active: count("ACTIVE"), discontinued: count("DISCONTINUED") },
      groups: MASTER_ITEM_GROUPS, lastSync,
      companies: companies.map((c) => c.company), businesses: businesses.map((b) => b.business),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
