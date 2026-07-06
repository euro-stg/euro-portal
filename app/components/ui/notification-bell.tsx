"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, X, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NotifItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  refId: string | null;
  appType: string | null;
  refUrl: string | null;
  read: boolean;
  createdAt: string;
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
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function NotificationBell() {
  const [unread, setUnread]       = useState(0);
  const [open, setOpen]           = useState(false);
  const [notifs, setNotifs]       = useState<NotifItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [detail, setDetail]       = useState<NotifItem | null>(null);
  const dropRef                   = useRef<HTMLDivElement>(null);
  const router                    = useRouter();

  const fetchCount = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications/count", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); setUnread(j.unread ?? 0); }
    } catch { /* ignore */ }
  }, []);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications?limit=10", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); setNotifs(j.data ?? []); setUnread(j.unread ?? 0); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Polling setiap 30 detik
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Buka dropdown → fetch notifs
  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  // Klik luar → tutup dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
  };

  return (
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Notifikasi</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <CheckCheck className="w-3.5 h-3.5" /> Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : notifs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Belum ada notifikasi</p>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors flex gap-3 ${
                    !n.read
                      ? "bg-blue-50 hover:bg-blue-100/70 border-l-2 border-l-blue-500"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-blue-500" : "bg-slate-200"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${appBadgeCls(n.appType)}`}>
                        {appLabel(n.appType)}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${!n.read ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            {notifs.some((n) => n.read) ? (
              <button onClick={deleteRead}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600">
                <X className="w-3 h-3" /> Hapus yang Dibaca
              </button>
            ) : <span />}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Lihat Semua <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${appBadgeCls(detail.appType)}`}>
                {appLabel(detail.appType)}
              </span>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
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
                  onClick={() => { setDetail(null); setOpen(false); router.push(detail.refUrl!); }}
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
