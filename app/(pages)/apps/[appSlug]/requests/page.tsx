"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus, Search, RefreshCw, FileText, Clock, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";

type Request = {
  id: string; requestNo: string; type: string; title: string; status: string;
  estimatedCompletedAt: string | null; createdAt: string;
  requester: { id: string; name: string | null; jobPositionName: string | null };
  pic: { id: string; name: string | null } | null;
  refApp: { id: string; name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Diajukan", IT_REVIEW: "Review IT",
  APPROVED_IT: "Menunggu Persetujuan", APPROVED_USER: "Disetujui",
  IN_PROGRESS: "Dalam Pengembangan", UAT: "UAT", UAT_REVISION: "Revisi UAT",
  DONE: "Selesai", REJECTED: "Ditolak", CANCELLED: "Dibatalkan",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  IT_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED_IT: "bg-orange-50 text-orange-700",
  APPROVED_USER: "bg-teal-50 text-teal-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  UAT: "bg-purple-50 text-purple-700",
  UAT_REVISION: "bg-pink-50 text-pink-700",
  DONE: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const inputCls = "border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

export default function SdRequestListPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [data, setData] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", type: "" });
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ variant, message });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const load = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(p) });
      if (mine) q.set("mine", "true");
      if (filters.search) q.set("search", filters.search);
      if (filters.status) q.set("status", filters.status);
      if (filters.type)   q.set("type", filters.type);

      const res = await fetch(`/api/sd/request?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal memuat data");
      setData(json.data);
      setTotalPages(json.meta.totalPages);
      setTotal(json.meta.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); }, [filters, mine]);
  useEffect(() => { load(page); }, [page]);

  const isOverdue = (r: Request) => {
    if (!r.estimatedCompletedAt) return false;
    if (["DONE", "CANCELLED", "REJECTED"].includes(r.status)) return false;
    return new Date(r.estimatedCompletedAt) < new Date();
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pengajuan</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} pengajuan</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Semua / Saya */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMine(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!mine ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Semua
            </button>
            <button
              onClick={() => setMine(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mine ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Pengajuan Saya
            </button>
          </div>
          <Button
            onClick={() => router.push(`/apps/${appSlug}/requests/new`)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buat Pengajuan
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputCls} pl-9 w-full`}
            placeholder="Cari judul atau nomor..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className={inputCls}
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="">Semua Tipe</option>
          <option value="NEW_APP">Aplikasi Baru</option>
          <option value="CHANGE_REQUEST">Perubahan</option>
        </select>
        <select
          className={inputCls}
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          onClick={() => load(page)}
          className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Memuat...
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">Belum ada pengajuan</p>
          <p className="text-slate-400 text-sm mt-1">Klik &ldquo;Buat Pengajuan&rdquo; untuk memulai</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/apps/${appSlug}/requests/${r.id}`)}
              className="w-full bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all p-4 text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                  <FileText className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{r.requestNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {r.type === "NEW_APP" ? "Aplikasi Baru" : "Perubahan"}
                    </span>
                    {isOverdue(r) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> TERLAMBAT
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-800 mt-1 truncate">{r.title}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                    <span>Oleh: {r.requester.name ?? "-"}</span>
                    {r.pic && <span>PIC: {r.pic.name}</span>}
                    {r.refApp && <span>App: {r.refApp.name}</span>}
                    {r.estimatedCompletedAt && (
                      <span className={`flex items-center gap-1 ${isOverdue(r) ? "text-red-500" : ""}`}>
                        <Clock className="w-3 h-3" />
                        Target: {new Date(r.estimatedCompletedAt).toLocaleDateString("id-ID")}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
