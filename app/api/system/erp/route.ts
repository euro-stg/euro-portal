import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { encrypt } from "@/lib/encryption";
import { forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import { DEFAULT_ERP_URL, ERP_KEYS, ErpError, getErpConfig, invalidateErpSession, testErpConnection } from "@/lib/erp";
import { CURSOR_KEY, EXCLUDE_KEYS, getMasterItemExclusions, purgeExcludedMasterItems } from "@/lib/master-item-sync";

// Pengaturan koneksi ERP (2026-10-28) — dipakai sync Master Item.
//   GET   → konfigurasi (password tidak pernah dikembalikan, hanya status sudah diset)
//   PATCH → { url, username, password? } simpan (password terenkripsi; kosong = tetap)
//   POST  → { url?, username?, password? } tes koneksi (nilai kosong = pakai yang tersimpan)
//   PUT   → { excludeCompanies, excludeBusinesses, excludeNoCompany } pengecualian Master Item
async function guard() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.erp]))) return { error: forbidden() };
  return { userId: session.user.id };
}

const isHttpsUrl = (v: string) => { try { return new URL(v).protocol === "https:"; } catch { return false; } };

export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const [rows, exclusions, companies, businesses] = await Promise.all([
      db.systemConfig.findMany({ where: { key: { in: Object.values(ERP_KEYS) } } }),
      getMasterItemExclusions(),
      db.masterItem.findMany({ where: { company: { not: null } }, distinct: ["company"], select: { company: true } }),
      db.masterItem.findMany({ where: { business: { not: null } }, distinct: ["business"], select: { business: true } }),
    ]);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    // Pilihan = yang ada di Master Item + yang sedang dikecualikan (item-nya sudah terhapus).
    const uniq = (a: (string | null)[]) => [...new Set(a.filter((v): v is string => !!v))].sort((x, y) => x.localeCompare(y));
    return NextResponse.json({
      data: { url: map[ERP_KEYS.url] || DEFAULT_ERP_URL, username: map[ERP_KEYS.username] ?? "", hasPassword: !!map[ERP_KEYS.password] },
      exclusions,
      options: {
        companies: uniq([...companies.map((c) => c.company), ...exclusions.companies]),
        businesses: uniq([...businesses.map((b) => b.business), ...exclusions.businesses]),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = (await request.json().catch(() => ({}))) as { url?: string; username?: string; password?: string };
    const url = body.url?.trim().replace(/\/+$/, "") ?? "";
    const username = body.username?.trim() ?? "";
    if (!isHttpsUrl(url)) return NextResponse.json({ message: "URL ERP harus diawali https://" }, { status: 400 });
    if (!username) return NextResponse.json({ message: "Username wajib diisi" }, { status: 400 });

    const updates: [string, string][] = [[ERP_KEYS.url, url], [ERP_KEYS.username, username]];
    if (body.password) updates.push([ERP_KEYS.password, encrypt(body.password)]);
    else if (!(await db.systemConfig.findUnique({ where: { key: ERP_KEYS.password } })))
      return NextResponse.json({ message: "Password wajib diisi" }, { status: 400 });

    await Promise.all(updates.map(([key, value]) => db.systemConfig.upsert({
      where: { key }, create: { key, value, updatedBy: g.userId }, update: { value, updatedBy: g.userId },
    })));
    invalidateErpSession();
    return NextResponse.json({ message: "Konfigurasi ERP disimpan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = (await request.json().catch(() => ({}))) as { url?: string; username?: string; password?: string };
    const saved = await getErpConfig().catch(() => null);
    const cfg = {
      url: (body.url?.trim() || saved?.url || DEFAULT_ERP_URL).replace(/\/+$/, ""),
      username: body.username?.trim() || saved?.username || "",
      password: body.password || saved?.password || "",
    };
    if (!isHttpsUrl(cfg.url)) return NextResponse.json({ message: "URL ERP harus diawali https://" }, { status: 400 });
    if (!cfg.username || !cfg.password) return NextResponse.json({ message: "Isi username & password dulu" }, { status: 400 });
    try {
      const info = await testErpConnection(cfg);
      return NextResponse.json({ message: `Terhubung ke ERPNext ${info.erpnextVersion ?? ""} — ${info.companies.length} company terlihat`, data: info });
    } catch (err) {
      const msg = err instanceof ErpError ? err.message : `Tidak bisa terhubung ke ERP: ${err instanceof Error ? err.message : String(err)}`;
      return NextResponse.json({ message: msg }, { status: 502 });
    } finally {
      invalidateErpSession(); // sesi tes tidak dipakai untuk sync
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = (await request.json().catch(() => ({}))) as { excludeCompanies?: unknown; excludeBusinesses?: unknown; excludeNoCompany?: unknown };
    const clean = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].sort() : []);
    const next = { companies: clean(body.excludeCompanies), businesses: clean(body.excludeBusinesses), noCompany: body.excludeNoCompany === true };
    const before = await getMasterItemExclusions();

    const values: [string, string][] = [
      [EXCLUDE_KEYS.companies, JSON.stringify(next.companies)],
      [EXCLUDE_KEYS.businesses, JSON.stringify(next.businesses)],
      [EXCLUDE_KEYS.noCompany, next.noCompany ? "true" : "false"],
    ];
    await Promise.all(values.map(([key, value]) => db.systemConfig.upsert({
      where: { key }, create: { key, value, updatedBy: g.userId }, update: { value, updatedBy: g.userId },
    })));

    const removed = await purgeExcludedMasterItems(next);
    // Ada yang DIKELUARKAN dari pengecualian → item-nya perlu diambil ulang: sync berikutnya penuh.
    const unExcluded = before.companies.some((c) => !next.companies.includes(c))
      || before.businesses.some((b) => !next.businesses.includes(b)) || (before.noCompany && !next.noCompany);
    if (unExcluded) await db.systemConfig.deleteMany({ where: { key: CURSOR_KEY } });

    return NextResponse.json({
      message: `Pengecualian disimpan${removed ? ` — ${removed} item dihapus dari Master Item` : ""}${unExcluded ? " — sync berikutnya akan mengambil ulang semua item" : ""}`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
