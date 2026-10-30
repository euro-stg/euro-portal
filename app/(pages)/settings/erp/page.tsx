"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Eye, EyeOff, Loader2, PlugZap, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

// Pengaturan koneksi ERP (2026-10-28) — dipakai sync Master Item. Login ke ERP memakai
// username & password (seperti browser); password disimpan terenkripsi & tidak pernah
// dikirim balik ke halaman ini.
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

export default function ErpSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [form, setForm] = useState({ url: "", username: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; companies?: string[] } | null>(null);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  // Pengecualian Master Item (2026-10-30): company/business yang tidak dipakai lagi.
  const [options, setOptions] = useState<{ companies: string[]; businesses: string[] }>({ companies: [], businesses: [] });
  const [excl, setExcl] = useState<{ companies: string[]; businesses: string[]; noCompany: boolean }>({ companies: [], businesses: [], noCompany: true });
  const [savingExcl, setSavingExcl] = useState(false);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/erp").then((r) => r.json()).then((j) => {
      if (cancelled || !j.data) return;
      setForm({ url: j.data.url, username: j.data.username, password: "" });
      setHasPassword(!!j.data.hasPassword);
      if (j.options) setOptions(j.options);
      if (j.exclusions) setExcl(j.exclusions);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/system/erp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      showToast(res.ok ? "success" : "error", json.message ?? "Gagal menyimpan");
      if (res.ok) { setForm((f) => ({ ...f, password: "" })); if (form.password) setHasPassword(true); }
    } finally { setSaving(false); }
  };

  const toggle = (kind: "companies" | "businesses", value: string) =>
    setExcl((e) => ({ ...e, [kind]: e[kind].includes(value) ? e[kind].filter((v) => v !== value) : [...e[kind], value] }));

  const saveExcl = async () => {
    setSavingExcl(true);
    try {
      const res = await fetch("/api/system/erp", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeCompanies: excl.companies, excludeBusinesses: excl.businesses, excludeNoCompany: excl.noCompany }),
      });
      const json = await res.json();
      showToast(res.ok ? "success" : "error", json.message ?? "Gagal menyimpan");
    } finally { setSavingExcl(false); }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/system/erp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      setTestResult({ ok: res.ok, message: json.message, companies: json.data?.companies });
    } finally { setTesting(false); }
  };

  return (
    <div>
      {toast && <div className="fixed top-16 right-4 z-50 min-w-72"><Alert variant={toast.variant} message={toast.message} /></div>}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center"><Database className="w-5 h-5 text-emerald-600" /></div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Pengaturan ERP</h1>
          <p className="text-slate-400 text-xs">Koneksi ke ERPNext untuk sync Master Item</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat...</div>
      ) : (
        <div className="space-y-5 max-w-2xl">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Koneksi</h2>
            <div>
              <label className={labelCls}>URL ERP</label>
              <input className={inputCls} placeholder="https://erp.contoh.com" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
              <p className="text-xs text-slate-400 mt-1">Harus https dengan sertifikat valid.</p>
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input className={inputCls} autoComplete="off" placeholder="akun integrasi ERP" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              <p className="text-xs text-slate-400 mt-1">Gunakan akun khusus integrasi (hak baca Item & Price List, akses semua company) — bukan akun pribadi.</p>
            </div>
            <div>
              <label className={labelCls}>Password {hasPassword && <span className="text-xs font-normal text-slate-400">(sudah tersimpan — kosongkan kalau tidak diganti)</span>}</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} autoComplete="new-password" className={`${inputCls} pr-10`}
                  placeholder={hasPassword ? "••••••••" : "Password ERP"} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => void save()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
              </Button>
              <Button variant="outline" onClick={() => void test()} disabled={testing} className="flex items-center gap-2">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Tes Koneksi
              </Button>
            </div>
            {testResult && (
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${testResult.ok ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"}`}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <div>
                  <p>{testResult.message}</p>
                  {testResult.companies && <p className="text-xs mt-1 opacity-80">{testResult.companies.join(" · ")}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4 text-slate-400" /> Pengecualian Data Master Item</h2>
              <p className="text-xs text-slate-400 mt-1">
                Item dari company / business yang dicentang <b>tidak diambil</b> dari ERP dan <b>dihapus</b> dari Master Item saat disimpan —
                untuk company atau business yang sudah tidak dipakai, supaya tidak rancu dengan item aktif bernama sama.
              </p>
            </div>
            {([["companies", "Company", options.companies], ["businesses", "Business", options.businesses]] as const).map(([kind, label, list]) => (
              <div key={kind}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label} dikecualikan</p>
                {list.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada data — jalankan Sync ERP di Master Item dulu.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {list.map((v) => {
                      const on = excl[kind].includes(v);
                      return (
                        <label key={v} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none ${on ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                          <input type="checkbox" className="rounded" checked={on} onChange={() => toggle(kind, v)} /> {v}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input type="checkbox" className="rounded" checked={excl.noCompany} onChange={(e) => setExcl((x) => ({ ...x, noCompany: e.target.checked }))} />
              Kecualikan item yang tidak punya company di ERP
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={() => void saveExcl()} disabled={savingExcl} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
                {savingExcl && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Pengecualian
              </Button>
              <p className="text-xs text-slate-400">Kalau ada yang dihapus dari daftar ini, sync berikutnya otomatis mengambil ulang semua item.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-600">Catatan:</strong> Tes Koneksi memakai isian di form (yang kosong memakai nilai tersimpan), jadi bisa dicoba sebelum disimpan.
            Master Item di-sync otomatis tiap hari pukul 01:30 WIB dan bisa dijalankan manual dari halaman Master Item. Password disimpan terenkripsi AES-256-GCM.
          </div>
        </div>
      )}
    </div>
  );
}
