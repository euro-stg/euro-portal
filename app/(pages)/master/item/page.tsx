"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, CloudDownload, History, Package, CheckCircle, AlertCircle, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";

// Master Item (2026-10-28) — salinan item ERP (sync otomatis 01:30 WIB + manual). Data hanya
// diubah di ERP; halaman ini cuma menampilkan. Lihat app/lib/master-item-sync.ts.
type ItemRow = {
  id: string; itemCode: string; itemName: string; itemGroup: string; stockUom: string | null;
  erpDisabled: boolean; status: string; erpModified: string | null; syncedAt: string;
  company: string | null; business: string | null; treatmentType: string | null; qtyPackage: number | null;
  description: string | null; isSalesItem: boolean;
  standardPrice: number | null; standardPriceValidFrom: string | null; standardPriceValidUpto: string | null;
};
type SyncLog = {
  id: string; trigger: string; status: string; processed: number | null; created: number | null;
  updated: number | null; error: string | null; startedAt: string; finishedAt: string | null;
};

const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const rupiah = (n: number) => n.toLocaleString("id-ID");
const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
// Harga standar diambil yang terbaru walau periodenya sudah lewat — tandai "berakhir".
const isExpired = (upto: string | null) => !!upto && upto < todayWib();
const fmtDay = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : null);
const selectCls = "h-9 border border-slate-200 rounded-lg px-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20";

export default function MasterItemPage() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ active: 0, discontinued: 0 });
  const [groups, setGroups] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [businesses, setBusinesses] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [filters, setFilters] = useState({ q: "", group: "", status: "", company: "", business: "" });
  const [qInput, setQInput] = useState("");
  const qTimer = useRef<NodeJS.Timeout | null>(null);
  const [syncing, setSyncing] = useState<"" | "inc" | "full">("");
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async (p: number, f: typeof filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (f.q) params.set("q", f.q);
      if (f.group) params.set("group", f.group);
      if (f.status) params.set("status", f.status);
      if (f.company) params.set("company", f.company);
      if (f.business) params.set("business", f.business);
      const res = await fetch(`/api/master-item?${params}`);
      if (!res.ok) return;
      const j = await res.json();
      setRows(j.data ?? []); setTotal(j.total ?? 0); setTotalPages(j.totalPages ?? 1); setPage(p);
      setSummary(j.summary ?? { active: 0, discontinued: 0 }); setGroups(j.groups ?? []); setLastSync(j.lastSync ?? null);
      setCompanies(j.companies ?? []); setBusinesses(j.businesses ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(1, filters), 0);
    return () => clearTimeout(t);
  }, [load, filters]);

  const onSearch = (v: string) => {
    setQInput(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setFilters((f) => ({ ...f, q: v.trim() })), 400);
  };

  const sync = async (full: boolean) => {
    if (full && !confirm("Sync penuh mengambil ulang semua item dari ERP dan menandai Discontinued item yang sudah tidak ada di ERP. Lanjutkan?")) return;
    setSyncing(full ? "full" : "inc");
    try {
      const res = await fetch("/api/master-item/sync", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full }),
        signal: AbortSignal.timeout(5 * 60_000),
      });
      const j = await res.json();
      showToast(res.ok ? "success" : "error", j.message ?? "Sync gagal");
      void load(1, filters);
    } catch {
      showToast("error", "Network error saat sync");
    } finally { setSyncing(""); }
  };

  const openLog = async () => {
    const res = await fetch("/api/talenta/sync-logs?type=master_item");
    if (res.ok) setLogs((await res.json()).data ?? []);
    setLogOpen(true);
  };

  return (
    <div>
      {toast && <div className="fixed top-16 right-4 z-50 min-w-72"><Alert variant={toast.variant} message={toast.message} /></div>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Master Item</h1>
            <p className="text-slate-400 text-xs">
              Data item dari ERP — {summary.active.toLocaleString("id-ID")} aktif · {summary.discontinued.toLocaleString("id-ID")} discontinued
              {lastSync && <> · sync terakhir {fmt(lastSync.startedAt)} ({lastSync.status === "success" ? "berhasil" : lastSync.status === "running" ? "berjalan" : "gagal"})</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(page, filters)} disabled={loading || !!syncing}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => void sync(false)} disabled={!!syncing} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
            {syncing === "inc" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            {syncing === "inc" ? "Syncing..." : "Sync ERP"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void sync(true)} disabled={!!syncing}>
            {syncing === "full" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null} Sync penuh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void openLog()}><History className="w-3.5 h-3.5" /> Log Sync</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="w-full pl-8 pr-3 h-9 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
            placeholder="Cari nama atau kode item..." value={qInput} onChange={(e) => onSearch(e.target.value)} />
        </div>
        <select className={selectCls} value={filters.group} onChange={(e) => setFilters((f) => ({ ...f, group: e.target.value }))}>
          <option value="">Semua grup</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={selectCls} value={filters.company} onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}>
          <option value="">Semua company</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectCls} value={filters.business} onChange={(e) => setFilters((f) => ({ ...f, business: e.target.value }))}>
          <option value="">Semua business</option>
          {businesses.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={selectCls} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{total.toLocaleString("id-ID")} item</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {filters.q || filters.group || filters.status || filters.company || filters.business ? "Tidak ada item untuk filter ini." : "Belum ada data. Atur koneksi di Pengaturan → ERP, lalu klik Sync ERP."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${loading ? "opacity-60" : ""}`}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Kode", "Nama Item", "Grup", "Company", "Business", "Jenis Treatment", "Harga Standar", "Status"].map((h) => (
                    <th key={h} className={`${h === "Harga Standar" ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = openId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr onClick={() => setOpenId(open ? null : r.id)} className={`border-b border-slate-50 cursor-pointer ${open ? "bg-emerald-50/40" : "hover:bg-slate-50/50"}`}>
                        <td className="px-4 py-2.5"><span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{r.itemCode}</span></td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.itemName}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.itemGroup}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.company ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.business ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.treatmentType ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {r.standardPrice != null ? (
                            <>
                              <span className="font-medium text-slate-800">{rupiah(r.standardPrice)}</span>
                              {isExpired(r.standardPriceValidUpto)
                                ? <span className="block text-[10px] text-amber-600">berakhir {fmtDay(r.standardPriceValidUpto)}</span>
                                : <span className="block text-[10px] text-slate-400">{r.standardPriceValidUpto ? `s/d ${fmtDay(r.standardPriceValidUpto)}` : "tanpa batas"}</span>}
                            </>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.status === "ACTIVE"
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Aktif</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium" title={r.erpDisabled ? "Disabled di ERP" : r.itemGroup === "Discontinued" ? "Grup Discontinued" : "Di luar cakupan / tidak ada di ERP"}>Discontinued</span>}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={8} className="px-4 py-3">
                            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                              <div><dt className="text-slate-400">Satuan</dt><dd className="text-slate-700">{r.stockUom ?? "—"}</dd></div>
                              <div><dt className="text-slate-400">Qty Paket</dt><dd className="text-slate-700">{r.qtyPackage ?? "—"}</dd></div>
                              <div><dt className="text-slate-400">Item Penjualan</dt><dd className="text-slate-700">{r.isSalesItem ? "Ya" : "Tidak"}</dd></div>
                              <div><dt className="text-slate-400">Diubah di ERP</dt><dd className="text-slate-700">{r.erpModified ? r.erpModified.slice(0, 16) : "—"}</dd></div>
                              <div className="col-span-2 md:col-span-2"><dt className="text-slate-400">Harga Standar (Standard Selling)</dt><dd className="text-slate-700">
                                {r.standardPrice != null
                                  ? <>{rupiah(r.standardPrice)} · berlaku {fmtDay(r.standardPriceValidFrom) ?? "—"} – {fmtDay(r.standardPriceValidUpto) ?? "tanpa batas"}
                                      {isExpired(r.standardPriceValidUpto) && <span className="ml-1 text-amber-600">(periode sudah berakhir — harga terbaru di ERP)</span>}</>
                                  : `Tidak ada harga untuk company ${r.company ?? "item ini"}`}
                              </dd></div>
                              <div className="col-span-2 md:col-span-4"><dt className="text-slate-400">Deskripsi</dt><dd className="text-slate-700 whitespace-pre-line">{r.description ?? "—"}</dd></div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => void load(p, filters)} />
        </div>
      )}

      <Modal open={logOpen} title="Log Sync Master Item" onClose={() => setLogOpen(false)} boxClassName="w-11/12 max-w-2xl">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada log sync.</p>
          ) : logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div className="mt-0.5 shrink-0">
                {log.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {log.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                {log.status === "running" && <Clock className="w-4 h-4 text-amber-500 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.trigger === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                    {log.trigger === "scheduled" ? "otomatis" : "manual"}
                  </span>
                  <span className="text-xs text-slate-500">{fmt(log.startedAt)}</span>
                  {log.finishedAt && <span className="text-xs text-slate-400">({Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)} dtk)</span>}
                </div>
                {log.status === "success" && <p className="text-xs text-slate-600 mt-1">Diproses: <b>{log.processed}</b> — Baru: <b>{log.created}</b> — Berubah: <b>{log.updated}</b></p>}
                {log.status === "error" && <p className="text-xs text-red-600 mt-1 break-words">{log.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
