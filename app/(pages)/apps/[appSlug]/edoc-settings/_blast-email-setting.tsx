"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MailWarning } from "lucide-react";

// Toggle global "Blast Email" E Document (2026-09-30) — proteksi testing, matikan
// sementara supaya percobaan approve tidak nyasar email ke user asli. Berbeda dari
// "notifications.email" (settings/notification, global untuk SEMUA app) — ini spesifik
// cuma untuk fitur Kriteria Email Blast E Document.
export function BlastEmailSetting({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/blast-email-setting");
      const json = await res.json();
      if (res.ok) setEnabled(!!json.enabled);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/edoc/blast-email-setting", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menyimpan"); return; }
      setEnabled(next);
      onSuccess(next ? "Blast Email diaktifkan" : "Blast Email dinonaktifkan");
    } finally { setSaving(false); }
  };

  return (
    <div className={`bg-white rounded-xl border p-5 flex items-start gap-4 transition-all ${enabled ? "border-slate-200" : "border-red-100 bg-red-50/30"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${enabled ? "bg-amber-50" : "bg-red-50"}`}>
        <MailWarning className={`w-5 h-5 ${enabled ? "text-amber-600" : "text-red-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-slate-800">Blast Email</p>
          {!enabled && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Nonaktif</span>}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Kirim email ke user yang cocok Kriteria Email Blast tiap file di-approve (nomor dokumen berhasil di-generate).
          Matikan sementara untuk proteksi saat testing, supaya tidak ada email nyasar ke user asli.
        </p>
      </div>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-300 shrink-0 mt-1" />
      ) : (
        <button
          onClick={() => void toggle()}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${enabled ? "bg-emerald-500" : "bg-slate-300"} ${saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
          {saving && <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white" />}
        </button>
      )}
    </div>
  );
}
