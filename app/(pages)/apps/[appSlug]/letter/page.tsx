"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus, Search, RefreshCw, FileSignature, Loader2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type LetterRow = {
  id: string;
  letterNo: string | null;
  title: string;
  status: string;
  createdAt: string;
  category: { code: string; name: string };
  company: { code: string; name: string };
  organization: { name: string; code: string | null } | null;
  requester: { id: string; name: string | null };
  approval: { status: string; currentStep: number } | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  DONE: "Selesai",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

const inputCls = "border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

export default function SsdLetterListPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [data, setData] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (p = page, q = filters.search, st = filters.status, m = mine) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q)  params.set("search", q);
      if (st) params.set("status", st);
      if (m)  params.set("mine", "true");
      const res = await fetch(`/api/ssd/letter?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data ?? []);
        setTotalPages(json.meta?.totalPages ?? 1);
        setTotal(json.meta?.total ?? 0);
        setPage(p);
      }
    } finally { setLoading(false); }
  }, [page, filters, mine]);

  useEffect(() => { void load(1, filters.search, filters.status, mine); }, [filters.status, mine]);

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val }));
      void load(1, val, filters.status, mine);
    }, 400);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Daftar Surat</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} surat</p>
        </div>
        <div className="flex items-center gap-2">
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
              Surat Saya
            </button>
          </div>
          <Button
            onClick={() => router.push(`/apps/${appSlug}/letter/new`)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Buat Surat
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputCls} pl-9 w-full`}
            placeholder="Cari judul atau nomor surat..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
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
          onClick={() => void load(page)}
          className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">Belum ada surat</p>
          <p className="text-slate-400 text-sm mt-1">Klik &ldquo;Buat Surat&rdquo; untuk membuat surat baru</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/apps/${appSlug}/letter/${r.id}`)}
              className="w-full bg-white rounded-xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all p-4 text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                  <FileSignature className="w-5 h-5 text-violet-400 group-hover:text-violet-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {r.letterNo ? (
                      <span className="text-xs font-mono bg-violet-50 text-violet-600 px-2 py-0.5 rounded">{r.letterNo}</span>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono">Belum ada nomor</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{r.category.code}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{r.company.code}</span>
                  </div>
                  <p className="font-semibold text-slate-800 truncate">{r.title}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span>Oleh: {r.requester.name ?? "-"}</span>
                    {r.organization && <span>{r.organization.name}</span>}
                    <span>{new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => void load(p)} />
        </div>
      )}
    </div>
  );
}
