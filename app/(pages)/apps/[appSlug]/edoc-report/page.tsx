"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, FileText, ChevronRight, ListChecks, CheckCircle2, XCircle, Clock, Search, RotateCcw } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

type ReportFile = {
  id: string; title: string; documentNumber: string | null; status: string;
  approvedAt: string | null; approvalNote: string | null; rejectedAt: string | null; rejectionNote: string | null;
  actedAt: string;
  category: { code: string; name: string } | null;
  categoryType: { name: string } | null;
  folder: { name: string } | null;
  uploader: { name: string | null; employeeId: string };
  approver: { name: string | null } | null;
  rejecter: { name: string | null } | null;
  organization: { name: string; code: string | null } | null;
};
type Report = { summary: { approved: number; rejected: number; pending: number }; data: ReportFile[]; total: number; page: number; pageSize: number };

const inputCls = "border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";

// Report Approver (2026-10-15) — riwayat dokumen yang sudah di-approve/di-reject oleh
// Document Approver mana pun, dengan filter "Hanya saya" + tanggal. Antrean yang masih
// menunggu tetap di menu Approval Document; di sini cuma jumlahnya (kartu Menunggu).
export default function EDocApprovalReportPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();
  // Hasil terakhir disimpan bersama query-nya; "loading" = query aktif belum punya hasil.
  const [result, setResult] = useState<{ key: string; report: Report | null; forbidden: boolean } | null>(null);
  const [mine, setMine] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ status, page: String(page) });
  if (mine) params.set("mine", "true");
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (query) params.set("q", query);
  const key = params.toString();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/edoc/file/approval-report?${key}`)
      .then(async (res) => ({ forbidden: res.status === 403, report: res.ok ? ((await res.json()) as Report) : null }))
      .catch(() => ({ forbidden: false, report: null }))
      .then((r) => { if (!cancelled) setResult({ key, ...r }); });
    return () => { cancelled = true; };
  }, [key]);

  const loading = result?.key !== key;
  const report = result?.report ?? null;
  const forbidden = !!result?.forbidden;

  const resetFilters = () => { setMine(false); setStatus("ALL"); setFrom(""); setTo(""); setQ(""); setQuery(""); setPage(1); };

  if (forbidden) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
        <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-500">Anda bukan Document Approver</p>
        <p className="text-slate-400 text-sm mt-1">Hubungi superadmin untuk mendapatkan role ini.</p>
      </div>
    );
  }

  const s = report?.summary;
  const cards = [
    { label: "Disetujui", value: s?.approved, icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", onClick: () => { setStatus("RELEASE"); setPage(1); } },
    { label: "Ditolak", value: s?.rejected, icon: XCircle, cls: "bg-red-50 text-red-600", onClick: () => { setStatus("REJECTED"); setPage(1); } },
    { label: "Menunggu Approval", value: s?.pending, icon: Clock, cls: "bg-amber-50 text-amber-600", onClick: () => router.push(`/apps/${appSlug}/edoc-approval`) },
  ];
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Report Approver</h1>
        <p className="text-sm text-slate-400 mt-0.5">Riwayat dokumen yang sudah disetujui atau ditolak</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {cards.map((c) => (
          <button key={c.label} onClick={c.onClick} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 text-left hover:shadow-sm transition-shadow">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.cls}`}><c.icon className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{c.value ?? "-"}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-4">Jumlah Disetujui &amp; Ditolak mengikuti filter di bawah; Menunggu Approval adalah antrean saat ini.</p>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {[{ v: false, l: "Semua approver" }, { v: true, l: "Hanya saya" }].map((o) => (
            <button key={o.l} onClick={() => { setMine(o.v); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md ${mine === o.v ? "bg-white shadow-sm text-slate-800 font-medium" : "text-slate-500"}`}>{o.l}</button>
          ))}
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">Disetujui &amp; Ditolak</option>
            <option value="RELEASE">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dari tanggal</label>
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
      ) : !report || report.data.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">Tidak ada dokumen untuk filter ini</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">{report.total} dokumen</p>
          <div className="space-y-2">
            {report.data.map((f) => {
              const rejected = f.status === "REJECTED";
              return (
                <button key={f.id} onClick={() => router.push(`/apps/${appSlug}/edoc-file/${f.id}`)}
                  className="w-full bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all p-4 text-left group">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${rejected ? "bg-red-50" : "bg-emerald-50"}`}>
                      <FileText className={`w-5 h-5 ${rejected ? "text-red-500" : "text-emerald-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rejected ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{rejected ? "Ditolak" : "Disetujui"}</span>
                        {f.documentNumber && <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{f.documentNumber}</span>}
                        {f.category && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.category.code}</span>}
                        {f.categoryType && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.categoryType.name}</span>}
                        {f.organization && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.organization.code ?? f.organization.name}</span>}
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{f.title}</p>
                      <div className="flex items-center gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400 flex-wrap">
                        <span>Oleh: {f.uploader.name ?? f.uploader.employeeId}</span>
                        <span>{rejected ? "Ditolak" : "Disetujui"} oleh {(rejected ? f.rejecter?.name : f.approver?.name) ?? "-"} · {fmt(f.actedAt)}</span>
                        {f.folder && <span>Folder: {f.folder.name}</span>}
                      </div>
                      {(rejected ? f.rejectionNote : f.approvalNote) && (
                        <p className="text-xs text-slate-500 mt-1 italic truncate">&ldquo;{rejected ? f.rejectionNote : f.approvalNote}&rdquo;</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Pagination currentPage={report.page} totalPages={Math.ceil(report.total / report.pageSize)} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
