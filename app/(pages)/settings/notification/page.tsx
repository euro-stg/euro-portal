"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Mail, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";

type Config = {
  "notifications.inapp": boolean;
  "notifications.email": boolean;
};

export default function NotificationSettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/config");
      const json = await res.json();
      if (res.ok) setConfig(json.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (key: keyof Config) => {
    if (!config) return;
    const newVal = !config[key];
    setSaving(key);
    try {
      const res = await fetch("/api/system/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newVal }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal menyimpan"); return; }
      setConfig((c) => c ? { ...c, [key]: newVal } : c);
      showToast("success", `Notifikasi ${newVal ? "diaktifkan" : "dinonaktifkan"}`);
    } finally { setSaving(null); }
  };

  const items = [
    {
      key: "notifications.inapp" as const,
      label: "Notifikasi In-App",
      desc: "Notifikasi yang muncul di dalam portal (bell icon). Jika dinonaktifkan, tidak ada notifikasi yang tersimpan ke database.",
      icon: MessageSquare,
      color: "blue",
    },
    {
      key: "notifications.email" as const,
      label: "Notifikasi Email",
      desc: "Pengiriman email via SMTP untuk setiap notifikasi. Nonaktifkan saat testing di production agar tidak mengirim email ke user nyata.",
      icon: Mail,
      color: "violet",
    },
  ];

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Notifikasi</h1>
            <p className="text-xs text-slate-400">Kontrol pengiriman notifikasi sistem secara global</p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Warning banner */}
      <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">!</span>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed">
          Pengaturan ini berlaku <strong>global</strong> untuk semua user dan semua aplikasi.
          Perubahan efektif dalam <strong>60 detik</strong> (cache TTL).
          Pastikan diaktifkan kembali setelah selesai testing.
        </p>
      </div>

      {/* Config cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat...
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ key, label, desc, icon: Icon, color }) => {
            const enabled = config?.[key] ?? true;
            const isSaving = saving === key;
            return (
              <div
                key={key}
                className={`bg-white rounded-xl border p-5 flex items-start gap-4 transition-all ${
                  enabled ? "border-slate-200" : "border-red-100 bg-red-50/30"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  enabled ? `bg-${color}-50` : "bg-red-50"
                }`}>
                  <Icon className={`w-5 h-5 ${enabled ? `text-${color}-600` : "text-red-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    {!enabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
                <button
                  onClick={() => void toggle(key)}
                  disabled={isSaving}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${
                    enabled ? "bg-emerald-500" : "bg-slate-300"
                  } ${isSaving ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`} />
                  {isSaving && (
                    <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      <p className="text-xs text-slate-400 text-center mt-6">
        Cache akan direset otomatis setiap 60 detik setelah perubahan terakhir.
      </p>
    </div>
  );
}
