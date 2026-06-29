"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, CloudDownload, History, Briefcase, CheckCircle, AlertCircle, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";

type JobPositionRow = {
  id: string;
  name: string;
  level: number | null;
  description: string | null;
  parentJobId: string | null;
  branchId: string | null;
  syncedAt: string;
};

type SyncLog = {
  id: string;
  type: string;
  trigger: string;
  status: string;
  processed: number | null;
  created: number | null;
  updated: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export default function JobPositionPage() {
  const [data, setData]           = useState<JobPositionRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [search, setSearch]       = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const [toast, setToast]     = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [logOpen, setLogOpen]   = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  function showToast(variant: "success" | "error", message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async (page = 1, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/job-position?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
        setCurrentPage(page);
      }
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { void load(1, search); }, []);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      void load(1, val);
    }, 400);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/talenta/sync-job-position", {
        method: "POST",
        signal: AbortSignal.timeout(2 * 60 * 1000),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Sync Job Position gagal"); return; }
      showToast("success", `Sync berhasil — Dibuat: ${json.created}, Diperbarui: ${json.updated}`);
      void load(1, search);
    } catch (err) {
      console.error(err);
      showToast("error", "Network error saat sync jabatan");
    } finally { setSyncing(false); }
  };

  const openLog = async () => {
    const res = await fetch("/api/talenta/sync-logs?type=job_position");
    if (res.ok) { const json = await res.json(); setSyncLogs(json.data ?? []); }
    setLogOpen(true);
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Master Jabatan</h1>
            <p className="text-slate-400 text-xs">Data jabatan dari Talenta — {total} jabatan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(currentPage, search)} disabled={loading || syncing}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
          >
            {syncing
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <CloudDownload className="w-3.5 h-3.5" />
            }
            {syncing ? "Syncing..." : "Sync Talenta"}
          </Button>
          <Button variant="secondary" size="sm" onClick={openLog}>
            <History className="w-3.5 h-3.5" />
            Log Sync
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full pl-8 pr-3 h-9 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          placeholder="Cari nama atau deskripsi jabatan..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {search ? "Tidak ada hasil pencarian." : "Belum ada data jabatan. Klik Sync Talenta untuk mengambil data."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Jabatan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deskripsi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{row.id}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {row.level != null ? (
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">L{row.level}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{row.branchId ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{row.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => void load(p, search)}
          />
        </div>
      )}

      {/* Log Modal */}
      <Modal open={logOpen} title="Log Sync Jabatan" onClose={() => setLogOpen(false)} boxClassName="w-11/12 max-w-2xl">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {syncLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada log sync jabatan.</p>
          ) : syncLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div className="mt-0.5 shrink-0">
                {log.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {log.status === "error"   && <AlertCircle className="w-4 h-4 text-red-500" />}
                {log.status === "running" && <Clock className="w-4 h-4 text-amber-500 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.trigger === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                    {log.trigger}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(log.startedAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {log.finishedAt && (
                    <span className="text-xs text-slate-400">
                      ({Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}d)
                    </span>
                  )}
                </div>
                {log.status === "success" && (
                  <p className="text-xs text-slate-600 mt-1">
                    Processed: <b>{log.processed}</b> — Dibuat: <b>{log.created}</b> — Diperbarui: <b>{log.updated}</b>
                  </p>
                )}
                {log.status === "error" && (
                  <p className="text-xs text-red-600 mt-1 truncate">{log.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
