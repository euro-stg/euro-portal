"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, CheckCircle2, Clock, Loader2, ChevronRight, AlertCircle } from "lucide-react";

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

type RecentItem = {
  id: string; requestNo: string; title: string; status: string;
  estimatedCompletedAt: string | null; createdAt: string;
  pic: { id: string; name: string | null } | null;
  requester: { id: string; name: string | null };
};

type Stats = { total: number; done: number; inProgress: number; recent: RecentItem[] };

export default function AppDashboardPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (appSlug !== "software-development") { setLoading(false); return; }
    fetch("/api/sd/stats")
      .then((r) => r.json())
      .then((j) => setStats(j))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [appSlug]);

  if (appSlug !== "software-development") {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="font-semibold text-slate-700">Dashboard aplikasi</p>
          <p className="text-slate-400 text-sm mt-1">Gunakan menu di sidebar untuk navigasi.</p>
        </div>
      </div>
    );
  }

  const isOverdue = (r: RecentItem) => {
    if (!r.estimatedCompletedAt) return false;
    if (["DONE", "CANCELLED", "REJECTED"].includes(r.status)) return false;
    return new Date(r.estimatedCompletedAt) < new Date();
  };

  return (
    <div>
      {/* Counter cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.total ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Pengajuan</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.inProgress ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Sedang Berjalan</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.done ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Selesai</p>
              </div>
            </div>
          </div>

          {/* Recent requests — full width */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Pengajuan Terbaru</h2>
              <button
                onClick={() => router.push(`/apps/${appSlug}/requests`)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                Lihat semua <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!stats?.recent?.length ? (
              <div className="p-12 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Belum ada pengajuan</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {stats.recent.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/apps/${appSlug}/requests/${r.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-mono text-slate-400">{r.requestNo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                        {isOverdue(r) && (
                          <span className="text-xs flex items-center gap-0.5 text-red-500 font-medium">
                            <AlertCircle className="w-3 h-3" /> Terlambat
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-700 truncate">{r.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                        <span>Oleh: {r.requester.name ?? "-"}</span>
                        {r.pic && <span>PIC: {r.pic.name}</span>}
                        <span>{new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {r.estimatedCompletedAt && (
                          <span className={isOverdue(r) ? "text-red-400" : ""}>
                            Target: {new Date(r.estimatedCompletedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
