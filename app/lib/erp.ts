import db from "@/lib/db/db";
import { decrypt } from "@/lib/encryption";

// Klien ERP (ERPNext/Frappe v12) — 2026-10-28. Login dengan username & password seperti
// browser (POST /api/method/login → cookie "sid"), sesi disimpan di memori proses & dipakai
// ulang; kalau ERP membalas 401/403 (sesi kedaluwarsa) login ulang sekali lalu ulangi request.
// Konfigurasi (URL, username, password terenkripsi) disimpan di SystemConfig lewat halaman
// Pengaturan ERP — tidak di .env, supaya bisa diganti tanpa deploy.

export const ERP_KEYS = { url: "erp.url", username: "erp.username", password: "erp.password" } as const;
export const DEFAULT_ERP_URL = "https://erpeuromedicagroup.com";

export type ErpConfig = { url: string; username: string; password: string };

export async function getErpConfig(): Promise<ErpConfig | null> {
  const rows = await db.systemConfig.findMany({ where: { key: { in: Object.values(ERP_KEYS) } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map[ERP_KEYS.username] || !map[ERP_KEYS.password]) return null;
  return {
    url: (map[ERP_KEYS.url] || DEFAULT_ERP_URL).replace(/\/+$/, ""),
    username: map[ERP_KEYS.username],
    password: decrypt(map[ERP_KEYS.password]),
  };
}

export class ErpError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

// Sesi per kombinasi URL+username; dibuang saat konfigurasi berubah (invalidateErpSession).
let session: { key: string; sid: string } | null = null;

export function invalidateErpSession() {
  session = null;
}

async function login(cfg: ErpConfig): Promise<string> {
  const res = await fetch(`${cfg.url}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usr: cfg.username, pwd: cfg.password }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401 || res.status === 403) throw new ErpError("Login ERP gagal — username atau password salah", res.status);
  if (!res.ok) throw new ErpError(`Login ERP gagal (HTTP ${res.status})`, res.status);
  const sid = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="))?.slice(4);
  if (!sid || sid === "Guest") throw new ErpError("Login ERP gagal — sesi tidak diterima");
  session = { key: `${cfg.url}|${cfg.username}`, sid };
  return sid;
}

/** GET ke API ERP dengan sesi aktif; login (ulang) otomatis bila perlu. */
export async function erpGet<T = unknown>(path: string, params?: Record<string, string>, cfgArg?: ErpConfig): Promise<T> {
  const cfg = cfgArg ?? (await getErpConfig());
  if (!cfg) throw new ErpError("Koneksi ERP belum dikonfigurasi (Pengaturan → ERP)");
  const key = `${cfg.url}|${cfg.username}`;
  const qs = params ? `?${new URLSearchParams(params)}` : "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const sid = session?.key === key && attempt === 0 ? session.sid : await login(cfg);
    const res = await fetch(`${cfg.url}${path}${qs}`, {
      headers: { Accept: "application/json", Cookie: `sid=${sid}` },
      signal: AbortSignal.timeout(120_000),
    });
    if ((res.status === 401 || res.status === 403) && attempt === 0) { session = null; continue; }
    if (!res.ok) throw new ErpError(`Request ERP gagal (HTTP ${res.status}) — ${path}`, res.status);
    return (await res.json()) as T;
  }
  throw new ErpError("Akses ERP ditolak setelah login ulang — periksa hak akses akun ERP", 403);
}

/** Ambil semua baris satu DocType (dipaginasi per `pageSize`). */
export async function erpListAll<T>(doctype: string, opts: { fields: string[]; filters?: unknown[]; orderBy?: string; pageSize?: number }): Promise<T[]> {
  const cfg = await getErpConfig();
  if (!cfg) throw new ErpError("Koneksi ERP belum dikonfigurasi (Pengaturan → ERP)");
  const pageSize = opts.pageSize ?? 1000;
  const out: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const res = await erpGet<{ data: T[] }>(`/api/resource/${encodeURIComponent(doctype)}`, {
      fields: JSON.stringify(opts.fields),
      ...(opts.filters ? { filters: JSON.stringify(opts.filters) } : {}),
      order_by: opts.orderBy ?? "modified asc",
      limit_start: String(start),
      limit_page_length: String(pageSize),
    }, cfg);
    out.push(...res.data);
    if (res.data.length < pageSize) return out;
  }
}

/** Tes koneksi: login + ringkasan akses (dipakai tombol "Tes Koneksi"). */
export async function testErpConnection(cfg: ErpConfig) {
  invalidateErpSession();
  await login(cfg);
  const [versions, companies] = await Promise.all([
    erpGet<{ message: Record<string, { version: string }> }>("/api/method/frappe.utils.change_log.get_versions", undefined, cfg),
    erpGet<{ data: { name: string }[] }>("/api/resource/Company", { limit_page_length: "100" }, cfg),
  ]);
  return {
    erpnextVersion: versions.message.erpnext?.version ?? null,
    companies: companies.data.map((c) => c.name),
  };
}
