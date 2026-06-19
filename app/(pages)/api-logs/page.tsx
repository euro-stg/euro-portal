"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Trash2, Loader2, Activity, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

type AppToken = { id: string; name: string; module: { name: string } | null };

type LogRow = {
  id: string;
  appTokenId: string | null;
  userId: string | null;
  method: string;
  endpoint: string;
  status: "SUCCESS" | "FAILED";
  statusCode: number | null;
  reason: string | null;
  ip: string | null;
  duration: number | null;
  createdAt: string;
  appToken: { id: string; name: string } | null;
  user: { id: string; name: string | null; employeeId: string } | null;
};

const LIMIT_OPTIONS = [10, 100, 1000] as const;
type LimitOption = typeof LIMIT_OPTIONS[number];

const selectCls = "h-9 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";
const inputCls  = "h-9 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white w-full";

export default function ApiLogsPage() {
  const [logs, setLogs]           = useState<LogRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit]         = useState<LimitOption>(10);

  const [appTokens, setAppTokens] = useState<AppToken[]>([]);

  const [filter, setFilter] = useState({
    appTokenId: "",
    endpoint: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const [alert, setAlert]           = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFrom, setDeleteFrom] = useState("");
  const [deleteTo, setDeleteTo]     = useState("");
  const [deleting, setDeleting]     = useState(false);
  const alertTimer = useRef<NodeJS.Timeout | null>(null);

  const showAlert = (variant: "success" | "error", message: string) => {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setAlert({ variant, message });
    alertTimer.current = setTimeout(() => setAlert(null), 4000);
  };

  const loadLogs = useCallback(async (p = 1, f = filter, lim: LimitOption = limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(lim) });
      if (f.appTokenId) params.set("appTokenId", f.appTokenId);
      if (f.endpoint)   params.set("endpoint", f.endpoint);
      if (f.status)     params.set("status", f.status);
      if (f.dateFrom)   params.set("dateFrom", f.dateFrom);
      if (f.dateTo)     params.set("dateTo", f.dateTo);
      const r = await fetch(`/api/api-logs?${params}`);
      if (r.ok) {
        const j = await r.json();
        setLogs(j.data ?? []);
        setTotal(j.total ?? 0);
        setTotalPages(j.totalPages ?? 1);
        setPage(p);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAppTokens = useCallback(async () => {
    const r = await fetch("/api/app-token");
    if (r.ok) {
      const j = await r.json();
      setAppTokens(j.data ?? []);
    }
  }, []);

  useEffect(() => {
    loadLogs(1, filter, limit);
    loadAppTokens();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = () => loadLogs(1, filter, limit);

  const handleLimitChange = (val: LimitOption) => {
    setLimit(val);
    loadLogs(1, filter, val);
  };

  const handleDelete = async () => {
    if (!deleteFrom && !deleteTo) return;
    setDeleting(true);
    try {
      const r = await fetch("/api/api-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom: deleteFrom || undefined, dateTo: deleteTo || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal menghapus"); return; }
      showAlert("success", `${j.deleted} log berhasil dihapus`);
      setDeleteOpen(false);
      setDeleteFrom(""); setDeleteTo("");
      loadLogs(1, filter, limit);
    } finally {
      setDeleting(false);
    }
  };

  const methodColor = (m: string) =>
    m === "POST" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">API Logs</h1>
            <p className="text-xs text-slate-400 mt-0.5">Aktivitas seluruh API yang dikonsumsi oleh aplikasi eksternal</p>
          </div>
        </div>
        <Button
          onClick={() => { setDeleteOpen(true); setDeleteFrom(""); setDeleteTo(""); }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4" /> Hapus Permanen
        </Button>
      </div>

      {alert && <div className="mb-4"><Alert variant={alert.variant} message={alert.message} /></div>}

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            className={selectCls}
            value={filter.appTokenId}
            onChange={(e) => setFilter((f) => ({ ...f, appTokenId: e.target.value }))}
          >
            <option value="">Semua Aplikasi</option>
            {appTokens.map((t) => (
              <option key={t.id} value={t.id}>{t.module?.name ?? t.name}</option>
            ))}
          </select>

          <select
            className={selectCls}
            value={filter.endpoint}
            onChange={(e) => setFilter((f) => ({ ...f, endpoint: e.target.value }))}
          >
            <option value="">Semua Endpoint</option>
            <option value="/api/sso/login">/api/sso/login</option>
            <option value="/api/sso/validate">/api/sso/validate</option>
          </select>

          <select
            className={selectCls}
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Semua Status</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>

          <input
            type="date"
            className={inputCls}
            value={filter.dateFrom}
            onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
            title="Dari tanggal"
          />
          <input
            type="date"
            className={inputCls}
            value={filter.dateTo}
            onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
            title="Sampai tanggal"
          />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Button onClick={applyFilter} className="h-8 text-sm px-4">Terapkan</Button>
          <button
            onClick={() => {
              const reset = { appTokenId: "", endpoint: "", status: "", dateFrom: "", dateTo: "" };
              setFilter(reset);
              loadLogs(1, reset, limit);
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Reset filter
          </button>
          <span className="ml-auto text-xs text-slate-400">{total.toLocaleString("id-ID")} log ditemukan</span>
        </div>
      </div>

      {/* Table header + page size */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Tampilkan</span>
          {LIMIT_OPTIONS.map((l) => (
            <button
              key={l}
              onClick={() => handleLimitChange(l)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                limit === l
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {l}
            </button>
          ))}
          <span className="text-xs text-slate-500">baris</span>
        </div>
        <button onClick={() => loadLogs(page, filter, limit)} className="p-1.5 text-slate-400 hover:text-slate-700">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">Belum ada log</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Waktu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aplikasi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Endpoint</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Keterangan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">IP</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ms</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {log.appToken?.name ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.user ? (
                        <div>
                          <p className="font-medium text-slate-700">{log.user.name ?? "—"}</p>
                          <p className="text-slate-400">{log.user.employeeId}</p>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${methodColor(log.method)}`}>
                          {log.method}
                        </span>
                        <code className="text-xs text-slate-600 font-mono">{log.endpoint}</code>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}>
                        {log.status === "SUCCESS" ? "Berhasil" : "Gagal"}
                        {log.statusCode && <span className="ml-1 opacity-60">·{log.statusCode}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-48 truncate" title={log.reason ?? ""}>
                      {log.reason ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {log.ip ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-slate-400 font-mono whitespace-nowrap">
                      {log.duration != null ? log.duration : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => loadLogs(page - 1, filter, limit)}
              className="px-3 py-1.5 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >← Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => loadLogs(p, filter, limit)}
                  className={`w-8 h-8 text-xs rounded border transition-colors ${
                    p === page ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >{p}</button>
              );
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => loadLogs(page + 1, filter, limit)}
              className="px-3 py-1.5 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >Next →</button>
          </div>
          <p className="text-xs text-slate-400">Halaman {page} dari {totalPages}</p>
        </div>
      )}

      {/* Modal: Hapus Permanen */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Hapus Log Permanen">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-800">Tindakan ini tidak bisa dibatalkan</p>
            <p className="text-xs text-red-700 mt-0.5">Semua log dalam rentang tanggal yang dipilih akan dihapus permanen.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Dari Tanggal</label>
              <input type="date" className={inputCls} value={deleteFrom} onChange={(e) => setDeleteFrom(e.target.value)} disabled={deleting} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Sampai Tanggal</label>
              <input type="date" className={inputCls} value={deleteTo} onChange={(e) => setDeleteTo(e.target.value)} disabled={deleting} />
            </div>
          </div>
          <p className="text-xs text-slate-400">Kosongkan salah satu untuk hapus semua sebelum/sesudah tanggal tertentu.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Batal</Button>
            <Button
              onClick={handleDelete}
              disabled={deleting || (!deleteFrom && !deleteTo)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Hapus Permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
