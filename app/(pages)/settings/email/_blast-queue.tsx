"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Antrean email blast (2026-10-28) — blast Euro Update & E Document dikirim worker satu per
// satu dengan jeda yang diatur di sini (lihat app/lib/email-queue.ts).
type QueueInfo = {
  queued: number; failed: number; intervalSeconds: number; estimateMinutes: number;
  nextDueAt: string | null; minIntervalSeconds: number; maxIntervalSeconds: number;
};

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

function useQueueInfo() {
  const [info, setInfo] = useState<QueueInfo | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/system/email-queue");
    if (res.ok) setInfo((await res.json()).data);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/email-queue").then(async (res) => { if (res.ok && !cancelled) setInfo((await res.json()).data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return { info, reload };
}

const fmtDuration = (minutes: number) =>
  minutes < 60 ? `${minutes} menit` : `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;

/** Kartu di tab Konfigurasi: atur jeda antar email blast. */
export function BlastIntervalCard({ onToast }: { onToast: (variant: "success" | "error", message: string) => void }) {
  const { info } = useQueueInfo();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = value ?? (info ? String(info.intervalSeconds) : "");
  const n = Number(current);
  const perHour = n > 0 ? Math.floor(3600 / n) : 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/system/email-queue", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intervalSeconds: n }),
      });
      const json = await res.json();
      onToast(res.ok ? "success" : "error", json.message ?? (res.ok ? "Disimpan" : "Gagal menyimpan"));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><Timer className="w-4 h-4 text-slate-400" /> Kecepatan Email Blast</h2>
      <p className="text-xs text-slate-400 mb-4">
        Email blast (Euro Update &amp; E Document) dikirim satu per satu lewat antrean supaya tidak ditolak server email.
        Email approval, notifikasi biasa, dan lupa password tetap dikirim langsung.
      </p>
      {!info ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1">Jeda antar email (detik)</label>
            <input type="number" min={info.minIntervalSeconds} max={info.maxIntervalSeconds} className={inputCls}
              value={current} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button onClick={() => void save()} disabled={saving || !(n >= info.minIntervalSeconds && n <= info.maxIntervalSeconds)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
          </Button>
          <p className="text-xs text-slate-500 pb-2">
            {perHour > 0 ? <>≈ <b>{perHour.toLocaleString("id-ID")}</b> email/jam — blast ke 1.000 orang selesai ±{fmtDuration(Math.ceil(1000 * n / 60))}</> : "Isi angka yang valid"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Ringkasan antrean di tab Log Keluar + kirim ulang yang gagal. */
export function BlastQueueSummary({ onToast, onRetried }: { onToast: (variant: "success" | "error", message: string) => void; onRetried?: () => void }) {
  const { info, reload } = useQueueInfo();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/system/email-queue", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry-failed" }),
      });
      const json = await res.json();
      onToast(res.ok ? "success" : "error", json.message ?? "Gagal");
      await reload(); onRetried?.();
    } finally { setBusy(false); }
  };

  if (!info) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="font-medium text-slate-700">Antrean email blast</span>
      <span className="text-slate-600">
        <b className="text-blue-700">{info.queued.toLocaleString("id-ID")}</b> menunggu
        {info.queued > 0 && <span className="text-slate-400"> · perkiraan selesai ±{fmtDuration(info.estimateMinutes)} (jeda {info.intervalSeconds} dtk)</span>}
      </span>
      <span className="text-slate-600"><b className={info.failed ? "text-red-600" : ""}>{info.failed.toLocaleString("id-ID")}</b> gagal</span>
      <div className="ml-auto flex items-center gap-2">
        {info.failed > 0 && (
          <Button variant="outline" size="sm" onClick={() => void retry()} disabled={busy} className="flex items-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Kirim ulang yang gagal
          </Button>
        )}
        <button onClick={() => void reload()} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Muat ulang">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
