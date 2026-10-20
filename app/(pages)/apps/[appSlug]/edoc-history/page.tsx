"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, FileText, ChevronRight, History, CheckCircle2, XCircle, Clock, Files, Search, RotateCcw } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

type HistoryFile = {
  id: string; title: string; documentNumber: string | null; status: string; bulkImported: boolean;
  createdAt: string; approvedAt: string | null; approvalNote: string | null; rejectedAt: string | null; rejectionNote: string | null;
  category: { code: string; name: string } | null;
  categoryType: { name: string } | null;
  folder: { name: string } | null;
  approver: { name: string | null } | null;
  rejecter: { name: string | null } | null;
  organization: { name: string; code: string | null } | null;
};
type History = {
  summary: { total: number; release: number; pending: number; rejected: number };
  data: HistoryFile[]; total: number; page: number; pageSize: number;
};

const inputCls = "border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";

// Status DRAFT di E Document = sudah diajukan & menunggu approval, jadi ditampilkan begitu.
const STATUS_UI: Record<string, { label: string; badge: string; icon: string; iconBg: string }> = {
  RELEASE:  { label: "Release",           badge: "bg-emerald-50 text-emerald-700", icon: "text-emerald-600", iconBg: "bg-emerald-50" },
  DRAFT:    { label: "Menunggu Approval", badge: "bg-amber-50 text-amber-700",     icon: "text-amber-600",   iconBg: "bg-amber-50" },
  REJECTED: { label: "Ditolak",           badge: "bg-red-50 text-red-700",         icon: "text-red-500",     iconBg: "bg-red-50" },
};

// History Upload (2026-10-20) — file yang di-upload user yang login saja, dengan kartu
// ringkasan per status. Pola sama dengan Report Approver (edoc-report).
export default function EDocUploadHistoryPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();
  // Hasil terakhir disimpan bersama query-nya; "loading" = query aktif belum punya hasil.
  const [result, setResult] = useState<{ key: string; history: History | null } | null>(null);
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ status, page: String(page) });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (query) params.set("q", query);
  const key = params.toString();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/edoc/file/my-uploads?${key}`)
      .then(async (res) => (res.ok ? ((await res.json()) as History) : null))
      .catch(() => null)
      .then((history) => { if (!cancelled) setResult({ key, history }); });
    return () => { cancelled = true; };
  }, [key]);

  const loading = result?.key !== key;
  const history = result?.history ?? null;

  const resetFilters = () => { setStatus("ALL"); setFrom(""); setTo(""); setQ(""); setQuery(""); setPage(1); };
  const pick = (s: string) => { setStatus(s); setPage(1); };

  const s = history?.summary;
  const cards = [
    { key: "ALL",      label: "Total Upload",      value: s?.total,    icon: Files,        cls: "bg-blue-50 text-blue-600" },
    { key: "RELEASE",  label: "Sukses (Release)",  value: s?.release,  icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
    { key: "DRAFT",    label: "Menunggu Approval", value: s?.pending,  icon: Clock,        cls: "bg-amber-50 text-amber-600" },
    { key: "REJECTED", label: "Ditolak",           value: s?.rejected, icon: XCircle,      cls: "bg-red-50 text-red-600" },
  ];
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">History Upload</h1>
        <p className="text-sm text-slate-400 mt-0.5">Dokumen yang Anda upload beserta status approval-nya</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {cards.map((c) => (
          <button key={c.key} onClick={() => pick(c.key)}
            className={`bg-white rounded-xl border p-4 flex items-center gap-4 text-left hover:shadow-sm transition-shadow ${status === c.key ? "border-blue-400 ring-2 ring-blue-500/10" : "border-slate-200"}`}>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${c.cls}`}><c.icon className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-800">{c.value ?? "-"}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-4">Jumlah di kartu mengikuti filter tanggal &amp; pencarian. Klik kartu untuk memfilter daftar.</p>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select className={inputCls} value={status} onChange={(e) => pick(e.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="RELEASE">Release</option>
            <option value="DRAFT">Menunggu Approval</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Upload dari tanggal</label>
          <input type="date" className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sampai tanggal</label>
          <input type="date" className={inputCls} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <form className="flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
          <label className="block text-xs text-slate-500 mb-1">Cari</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className={`${inputCls} w-full pl-9`} placeholder="Judul atau nomor dokumen, tekan Enter" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </form>
        <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-2 py-2">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...</div>
      ) : !history || history.data.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">{history?.summary.total === 0 && status === "ALL" && !from && !to && !query ? "Anda belum pernah meng-upload dokumen" : "Tidak ada dokumen untuk filter ini"}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">{history.total} dokumen</p>
          <div className="space-y-2">
            {history.data.map((f) => {
              const ui = STATUS_UI[f.status] ?? STATUS_UI.DRAFT;
              const rejected = f.status === "REJECTED";
              const acted = rejected ? f.rejectedAt : f.status === "RELEASE" ? f.approvedAt : null;
              const actor = rejected ? f.rejecter?.name : f.approver?.name;
              const note = rejected ? f.rejectionNote : f.status === "RELEASE" ? f.approvalNote : null;
              return (
                <button key={f.id} onClick={() => router.push(`/apps/${appSlug}/edoc-file/${f.id}`)}
                  className="w-full bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all p-4 text-left group">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ui.iconBg}`}>
                      <FileText className={`w-5 h-5 ${ui.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ui.badge}`}>{ui.label}</span>
                        {f.bulkImported && <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded">Bulk Import</span>}
                        {f.documentNumber && <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{f.documentNumber}</span>}
                        {f.category && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.category.code}</span>}
                        {f.categoryType && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.categoryType.name}</span>}
                        {f.organization && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.organization.code ?? f.organization.name}</span>}
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{f.title}</p>
                      <div className="flex items-center gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400 flex-wrap">
                        <span>Diupload {fmt(f.createdAt)}</span>
                        {acted && <span>{rejected ? "Ditolak" : "Disetujui"} oleh {actor ?? "-"} · {fmt(acted)}</span>}
                        {f.folder && <span>Folder: {f.folder.name}</span>}
                      </div>
                      {note && (
                        <p className={`text-xs mt-1 italic truncate ${rejected ? "text-red-600" : "text-slate-500"}`}>
                          {rejected ? "Alasan ditolak: " : ""}&ldquo;{note}&rdquo;
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Pagination currentPage={history.page} totalPages={Math.ceil(history.total / history.pageSize)} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
