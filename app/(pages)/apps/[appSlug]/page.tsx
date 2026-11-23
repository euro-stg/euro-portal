"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, CheckCircle2, Clock, Loader2, FileSignature, Send, XCircle, BadgeCheck } from "lucide-react";
import { EuFeedPage } from "./_eu-feed";
import { EDocApp } from "./_edoc-app";

type Stats = { total: number; done: number; inProgress: number };
type SsdStats = { total: number; draft: number; submitted: number; approved: number; rejected: number; done: number; mine: number };

export default function AppDashboardPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [ssdStats, setSsdStats] = useState<SsdStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (appSlug === "euro-update") { setLoading(false); return; }
    if (appSlug === "software-development") {
      fetch("/api/sd/stats")
        .then((r) => r.json())
        .then((j) => setStats(j))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (appSlug === "ssd") {
      fetch("/api/ssd/stats")
        .then((r) => r.json())
        .then((j) => setSsdStats(j))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [appSlug]);

  if (appSlug === "euro-update") return <EuFeedPage />;
  if (appSlug === "e-document") return <EDocApp />;

  if (appSlug === "ssd") {
    return (
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Total Surat", value: ssdStats?.total ?? 0, icon: FileSignature, color: "blue" },
                { label: "Menunggu Approval", value: ssdStats?.submitted ?? 0, icon: Send, color: "amber" },
                { label: "Disetujui", value: ssdStats?.approved ?? 0, icon: CheckCircle2, color: "emerald" },
                { label: "Selesai", value: ssdStats?.done ?? 0, icon: BadgeCheck, color: "teal" },
                { label: "Ditolak", value: ssdStats?.rejected ?? 0, icon: XCircle, color: "red" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl bg-${color}-50 flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 text-${color}-600`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <FileSignature className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-600">Sentralisasi Surat Dokumen</p>
              <p className="text-sm text-slate-400 mt-1">Gunakan menu di sidebar untuk membuat dan mengelola surat.</p>
              <button
                onClick={() => router.push(`/apps/${appSlug}/letter`)}
                className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Lihat Daftar Surat
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

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

  return (
    <>
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
        </>
      )}
    </div>
    </>
  );
}
