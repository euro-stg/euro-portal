"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";


type NotifItem = {
  id: string; title: string; body: string;
  type: string; refId: string | null; appType: string | null; refUrl: string | null;
  read: boolean; createdAt: string;
};

const APP_LABELS: Record<string, string> = {
  SD: "Software Development",
  GENERAL: "Portal",
};
function appLabel(appType: string | null) {
  if (!appType) return "Portal";
  return APP_LABELS[appType] ?? appType;
}
const APP_BADGE: Record<string, string> = {
  SD:      "bg-indigo-100 text-indigo-700",
  GENERAL: "bg-slate-100 text-slate-500",
};
function appBadgeCls(appType: string | null) {
  return APP_BADGE[appType ?? ""] ?? "bg-slate-100 text-slate-500";
}


function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState<NotifItem[]>([]);
  const [total, setTotal]     = useState(0);
  const [unread, setUnread]   = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail]   = useState<NotifItem | null>(null);
  const limit = 20;
  const router = useRouter();

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/notifications?page=${p}&limit=${limit}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setNotifs(j.data ?? []);
      setTotal(j.total ?? 0);
      setUnread(j.unread ?? 0);
      setPage(p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const markRead = async (notif: NotifItem) => {
    if (!notif.read) {
      await fetch(`/api/notifications/${notif.id}/read`, { method: "PATCH" });
      setNotifs((p) => p.map((n) => n.id === notif.id ? { ...n, read: true } : n));
      setUnread((p) => Math.max(0, p - 1));
    }
    setDetail(notif);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifs((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const deleteRead = async () => {
    await fetch("/api/notifications/delete-read", { method: "PATCH" });
    setNotifs((p) => p.filter((n) => !n.read));
    setTotal((p) => p - notifs.filter((n) => n.read).length);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-500" /> Notifikasi
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}</p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button variant="outline" onClick={markAllRead} className="flex items-center gap-2 text-xs">
              <CheckCheck className="w-3.5 h-3.5" /> Tandai Semua Dibaca
            </Button>
          )}
          {notifs.some((n) => n.read) && (
            <Button variant="outline" onClick={deleteRead} className="flex items-center gap-2 text-xs text-red-500 border-red-200 hover:bg-red-50">
              <X className="w-3.5 h-3.5" /> Hapus yang Sudah Dibaca
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Bell className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Belum ada notifikasi</p>
          </div>
        ) : (
          notifs.map((n, i) => (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={`w-full text-left px-5 py-4 flex gap-3 transition-colors ${i < notifs.length - 1 ? "border-b border-slate-100" : ""} ${
                !n.read
                  ? "bg-blue-50 hover:bg-blue-100/70 border-l-2 border-l-blue-500"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-blue-500" : "bg-slate-200"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${appBadgeCls(n.appType)}`}>
                    {appLabel(n.appType)}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                </div>
                <p className={`text-sm ${!n.read ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>{n.title}</p>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" onClick={() => load(page - 1)} disabled={page <= 1 || loading} className="text-xs">← Sebelumnya</Button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <Button variant="outline" onClick={() => load(page + 1)} disabled={page >= totalPages || loading} className="text-xs">Berikutnya →</Button>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${appBadgeCls(detail.appType)}`}>
                {appLabel(detail.appType)}
              </span>
              <button onClick={() => setDetail(null)}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-2">{detail.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{detail.body}</p>
            <p className="text-xs text-slate-400 mt-4">{timeAgo(detail.createdAt)}</p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setDetail(null)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                <Check className="w-3.5 h-3.5" /> Tutup
              </button>
              {detail.refUrl && (
                <button
                  onClick={() => { setDetail(null); router.push(`${detail.refUrl}?_r=${Date.now()}`); }}
                  className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Buka Detail
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
