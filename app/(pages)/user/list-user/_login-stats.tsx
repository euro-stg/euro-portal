"use client";

import { useState } from "react";
import { BarChart3, Download, RefreshCw, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// Statistik Login (2026-11-11) — tombol di halaman User, data dari GET /api/user/login-stats.
type Bucket = { name: string; total: number; everLoggedIn: number; active30: number };
type UserStat = {
  id: string; employeeId: string; name: string | null; department: string; organizationName: string | null;
  branchName: string | null; jobPositionName: string | null; lastLoginAt: string | null; loginCount: number;
};
type LogRow = { id: string; employeeId: string; userName: string | null; channel: string; appName: string | null; success: boolean; reason: string | null; ip: string | null; createdAt: string };
type Stats = {
  summary: { total: number; everLoggedIn: number; neverLoggedIn: number; active7: number; active30: number; failed7: number };
  trackingSince: string | null; byDepartment: Bucket[]; byBranch: Bucket[]; users: UserStat[]; recent: LogRow[];
};

const DAY = 86_400_000;
const num = (n: number) => n.toLocaleString("id-ID");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const tabCls = (on: boolean) => `px-3 py-1.5 text-sm rounded-md ${on ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;

// Sel CSV — teks diawali = + - @ diberi awalan ' supaya tidak dijalankan Excel sebagai formula.
const csvCell = (v: string | number | null) => {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v) : /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function LoginStatsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Stats | null>(null);
  const [loadedAt, setLoadedAt] = useState(0); // patokan "30 hari terakhir" = saat data dimuat
  const [tab, setTab] = useState<"summary" | "users" | "log">("summary");
  const [groupBy, setGroupBy] = useState<"department" | "branch">("department");
  const [userFilter, setUserFilter] = useState<"never" | "inactive30" | "all">("never");
  const [q, setQ] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/user/login-stats");
      const j = await res.json();
      if (!res.ok) { setError(j.message || "Gagal memuat statistik"); return; }
      setData(j);
      setLoadedAt(Date.now());
    } catch {
      setError("Network error");
    } finally { setLoading(false); }
  };

  const openModal = () => { setOpen(true); void load(); };

  const filteredUsers = (data?.users ?? []).filter((u) => {
    if (userFilter === "never" && u.lastLoginAt) return false;
    if (userFilter === "inactive30" && u.lastLoginAt && new Date(u.lastLoginAt).getTime() > loadedAt - 30 * DAY) return false;
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return [u.name, u.employeeId, u.department, u.branchName, u.jobPositionName].some((v) => v?.toLowerCase().includes(term));
  });

  const exportCsv = () => {
    const head = ["Employee ID", "Nama", "Departemen", "Organisasi", "Branch", "Jabatan", "Terakhir Login", "Jumlah Login"];
    const lines = [head.join(","), ...filteredUsers.map((u) => [
      u.employeeId, u.name, u.department, u.organizationName, u.branchName, u.jobPositionName,
      u.lastLoginAt ? fmt(u.lastLoginAt) : "Belum pernah", u.loginCount,
    ].map(csvCell).join(","))];
    const blob = new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `statistik-login-${userFilter}-${new Date(loadedAt + 7 * 3600_000).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = data?.summary;
  const buckets = groupBy === "department" ? data?.byDepartment ?? [] : data?.byBranch ?? [];
  const logs = (data?.recent ?? []).filter((l) => !failedOnly || !l.success);

  return (
    <>
      <Button variant="outline" size="sm" onClick={openModal}>
        <BarChart3 className="w-3.5 h-3.5" />
        Statistik Login
      </Button>

      <Modal open={open} title="Statistik Login Portal" onClose={() => setOpen(false)} boxClassName="w-11/12 max-w-4xl">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={tabCls(tab === "summary")} onClick={() => setTab("summary")}>Ringkasan</button>
            <button type="button" className={tabCls(tab === "users")} onClick={() => setTab("users")}>Daftar Karyawan</button>
            <button type="button" className={tabCls(tab === "log")} onClick={() => setTab("log")}>Riwayat Login</button>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {!data && loading && <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>}

          {data && s && tab === "summary" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  ["Karyawan aktif", num(s.total), "text-slate-800"],
                  ["Pernah login", `${num(s.everLoggedIn)} (${pct(s.everLoggedIn, s.total)}%)`, "text-emerald-700"],
                  ["Belum pernah login", `${num(s.neverLoggedIn)} (${pct(s.neverLoggedIn, s.total)}%)`, "text-amber-700"],
                  ["Login 7 hari terakhir", num(s.active7), "text-blue-700"],
                  ["Login 30 hari terakhir", num(s.active30), "text-blue-700"],
                ].map(([label, value, cls]) => (
                  <div key={label} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-lg font-semibold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Login gagal 7 hari terakhir: <b className={s.failed7 > 0 ? "text-red-600" : ""}>{num(s.failed7)}</b>
                {" · "}Riwayat login tercatat sejak {data.trackingSince ? fmt(data.trackingSince) : "fitur ini dirilis"}.
                Data &ldquo;pernah login&rdquo; sebelum itu adalah perkiraan dari jejak sesi &amp; SSO yang tersimpan.
              </p>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-700">Adopsi per</span>
                  <button type="button" className={tabCls(groupBy === "department")} onClick={() => setGroupBy("department")}>Departemen</button>
                  <button type="button" className={tabCls(groupBy === "branch")} onClick={() => setGroupBy("branch")}>Branch</button>
                  <span className="text-xs text-slate-400 ml-auto">diurutkan dari adopsi terendah</span>
                </div>
                <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-xs text-slate-500">
                        <th className="text-left px-3 py-2">{groupBy === "department" ? "Departemen" : "Branch"}</th>
                        <th className="text-right px-3 py-2">Karyawan</th>
                        <th className="text-right px-3 py-2">Pernah login</th>
                        <th className="px-3 py-2 w-40">Adopsi</th>
                        <th className="text-right px-3 py-2">Aktif 30 hari</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((b) => {
                        const p = pct(b.everLoggedIn, b.total);
                        return (
                          <tr key={b.name} className="border-t border-slate-50">
                            <td className="px-3 py-1.5 text-slate-700">{b.name}</td>
                            <td className="px-3 py-1.5 text-right">{num(b.total)}</td>
                            <td className="px-3 py-1.5 text-right">{num(b.everLoggedIn)}</td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div className={`h-full ${p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${p}%` }} />
                                </div>
                                <span className="text-xs text-slate-500 w-9 text-right">{p}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right">{num(b.active30)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {data && tab === "users" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className="h-9 border border-slate-200 rounded-lg px-2 text-sm bg-white" value={userFilter} onChange={(e) => setUserFilter(e.target.value as typeof userFilter)}>
                  <option value="never">Belum pernah login</option>
                  <option value="inactive30">Tidak login 30 hari terakhir</option>
                  <option value="all">Semua karyawan aktif</option>
                </select>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input className="w-full pl-8 pr-3 h-9 border border-slate-200 rounded-lg text-sm" placeholder="Cari nama, ID, departemen, branch..." value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <span className="text-xs text-slate-400">{num(filteredUsers.length)} karyawan</span>
                <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={filteredUsers.length === 0}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-xs text-slate-500">
                      <th className="text-left px-3 py-2">Karyawan</th>
                      <th className="text-left px-3 py-2">Departemen</th>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-left px-3 py-2">Terakhir login</th>
                      <th className="text-right px-3 py-2">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice(0, 500).map((u) => (
                      <tr key={u.id} className="border-t border-slate-50">
                        <td className="px-3 py-1.5">
                          <p className="text-slate-800">{u.name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{u.employeeId}{u.jobPositionName ? ` · ${u.jobPositionName}` : ""}</p>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-slate-600">{u.department}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-600">{u.branchName ?? "—"}</td>
                        <td className="px-3 py-1.5 text-xs">{u.lastLoginAt ? fmt(u.lastLoginAt) : <span className="text-amber-600">Belum pernah</span>}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{num(u.loginCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length > 500 && <p className="text-xs text-slate-400 text-center py-2">Menampilkan 500 pertama — gunakan pencarian atau Export CSV untuk daftar lengkap.</p>}
              </div>
              <p className="text-xs text-slate-400">Jumlah login dihitung sejak fitur ini dirilis.</p>
            </div>
          )}

          {data && tab === "log" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} /> Hanya login gagal
              </label>
              <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-lg">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Belum ada riwayat login.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-xs text-slate-500">
                        <th className="text-left px-3 py-2">Waktu</th>
                        <th className="text-left px-3 py-2">Karyawan</th>
                        <th className="text-left px-3 py-2">Lewat</th>
                        <th className="text-left px-3 py-2">Hasil</th>
                        <th className="text-left px-3 py-2">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className="border-t border-slate-50">
                          <td className="px-3 py-1.5 text-xs whitespace-nowrap">{fmt(l.createdAt)}</td>
                          <td className="px-3 py-1.5"><p className="text-slate-800">{l.userName ?? "—"}</p><p className="text-xs text-slate-400">{l.employeeId}</p></td>
                          <td className="px-3 py-1.5 text-xs">{l.channel === "SSO" ? `SSO${l.appName ? ` · ${l.appName}` : ""}` : "Portal"}</td>
                          <td className="px-3 py-1.5 text-xs">
                            {l.success ? <span className="text-emerald-700">Berhasil</span> : <span className="text-red-600">Gagal{l.reason ? ` — ${l.reason}` : ""}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-500">{l.ip ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <p className="text-xs text-slate-400">Menampilkan 100 percobaan login terakhir.</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
