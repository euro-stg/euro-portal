"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Send, Eye, EyeOff, Loader2, RefreshCw, CheckCircle2, AlertCircle, List, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type SmtpData = { host: string; port: string; secure: boolean; user: string; hasPass: boolean; from: string };
type LogRow = { id: string; to: string; subject: string; source: string; status: string; error: string | null; createdAt: string };

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

const SOURCE_LABELS: Record<string, string> = { ssd: "SSD", sd: "SD", portal: "Portal", system: "System" };
const SOURCE_COLORS: Record<string, string> = {
  ssd:    "bg-violet-100 text-violet-700",
  sd:     "bg-blue-100 text-blue-700",
  portal: "bg-slate-100 text-slate-700",
  system: "bg-amber-100 text-amber-700",
};

export default function EmailSettingsPage() {
  const [tab, setTab] = useState<"config" | "log">("config");

  // ── Config state ─────────────────────────────────────────────────
  const [data, setData] = useState<SmtpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ host: "", port: "587", secure: false, user: "", pass: "", from: "" });
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Log state ─────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logLoading, setLogLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ status: "", source: "", from: "", to: "" });
  const [deleteDate, setDeleteDate] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ── Load SMTP config ──────────────────────────────────────────────
  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/smtp");
      const json = await res.json();
      if (res.ok && json.data) {
        const d: SmtpData = json.data;
        setData(d);
        setForm({ host: d.host, port: d.port, secure: d.secure, user: d.user, pass: "", from: d.from });
      }
    } finally { setLoading(false); }
  };

  // ── Load logs ─────────────────────────────────────────────────────
  const loadLogs = async (page = 1) => {
    setLogLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (logFilter.status) params.set("status", logFilter.status);
      if (logFilter.source) params.set("source", logFilter.source);
      if (logFilter.from)   params.set("from",   logFilter.from);
      if (logFilter.to)     params.set("to",     logFilter.to);
      const res = await fetch(`/api/system/email-logs?${params}`);
      const json = await res.json();
      if (res.ok) {
        setLogs(json.data ?? []);
        setLogTotal(json.total ?? 0);
        setLogPage(json.page ?? 1);
        setLogTotalPages(json.totalPages ?? 1);
      }
    } finally { setLogLoading(false); }
  };

  useEffect(() => { void loadConfig(); }, []);
  useEffect(() => { if (tab === "log") void loadLogs(1); }, [tab]);

  const handleSave = async () => {
    if (!form.host.trim()) { showToast("error", "Host wajib diisi"); return; }
    if (!form.user.trim()) { showToast("error", "Username wajib diisi"); return; }
    if (!form.from.trim()) { showToast("error", "From address wajib diisi"); return; }
    if (!data?.hasPass && !form.pass.trim()) { showToast("error", "Password wajib diisi"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { host: form.host, port: form.port, secure: form.secure, user: form.user, from: form.from };
      if (form.pass.trim()) body.pass = form.pass;
      const res = await fetch("/api/system/smtp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal menyimpan"); return; }
      showToast("success", json.message);
      setForm((f) => ({ ...f, pass: "" }));
      void loadConfig();
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) { showToast("error", "Masukkan email tujuan test"); return; }
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/system/smtp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testEmail }) });
      const json = await res.json();
      setTestResult({ ok: res.ok, message: json.message });
      if (res.ok) setTimeout(() => void loadLogs(1), 800);
    } finally { setTesting(false); }
  };

  const handleDelete = async () => {
    if (!deleteDate) { showToast("error", "Pilih tanggal batas hapus"); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/system/email-logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ before: deleteDate }) });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message); return; }
      showToast("success", json.message);
      setDeleteDate(""); setDeleteConfirm(false);
      void loadLogs(1);
    } finally { setDeleting(false); }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <Mail className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Pengaturan Email</h1>
            <p className="text-xs text-slate-400">Konfigurasi SMTP dan monitoring log email keluar</p>
          </div>
        </div>
        <button
          onClick={() => tab === "config" ? void loadConfig() : void loadLogs(logPage)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${(loading || logLoading) ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["config", "log"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-violet-600 text-violet-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "config" ? <Mail className="w-4 h-4" /> : <List className="w-4 h-4" />}
            {t === "config" ? "Konfigurasi" : `Log Keluar${logTotal > 0 && tab === "log" ? ` (${logTotal})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── Tab: Konfigurasi ── */}
      {tab === "config" && (
        loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Konfigurasi SMTP</h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>SMTP Host</label>
                  <input className={inputCls} placeholder="smtp.gmail.com" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Port</label>
                  <input className={inputCls} placeholder="587" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <button type="button" onClick={() => setForm((f) => ({ ...f, secure: !f.secure }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.secure ? "bg-emerald-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.secure ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-700">SSL/TLS</p>
                  <p className="text-xs text-slate-400">{form.secure ? "Aktif — port biasanya 465" : "Nonaktif — pakai STARTTLS, port 587"}</p>
                </div>
              </label>

              <div>
                <label className={labelCls}>Username / Email</label>
                <input className={inputCls} placeholder="noreply@euromedica.co.id" value={form.user} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} />
              </div>

              <div>
                <label className={labelCls}>
                  Password
                  {data?.hasPass && <span className="ml-2 text-xs text-emerald-600 font-normal">✓ sudah diset — kosongkan jika tidak ingin mengubah</span>}
                </label>
                <div className="relative">
                  <input className={`${inputCls} pr-10`} type={showPass ? "text" : "password"}
                    placeholder={data?.hasPass ? "••••••••" : "Password SMTP"} value={form.pass}
                    onChange={(e) => setForm((f) => ({ ...f, pass: e.target.value }))} />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>From Address</label>
                <input className={inputCls} placeholder="noreply@euromedica.co.id" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
                <p className="text-xs text-slate-400 mt-1">Alamat pengirim yang tertera di email (bisa berbeda dari username)</p>
              </div>

              <div className="pt-1">
                <Button onClick={() => void handleSave()} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Test Kirim Email</h2>
              <p className="text-xs text-slate-400 mb-4">Kirim email percobaan untuk memverifikasi konfigurasi SMTP.</p>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} placeholder="alamat@email.com" value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleTest(); }} />
                <Button onClick={() => void handleTest()} disabled={testing} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shrink-0">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? "Mengirim..." : "Kirim Test"}
                </Button>
              </div>
              {testResult && (
                <div className={`mt-3 flex items-start gap-2.5 p-3 rounded-lg border text-sm ${testResult.ok ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"}`}>
                  {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <p>{testResult.message}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-600">Catatan:</strong> Jika SMTP belum dikonfigurasi, portal tidak akan mengirim email apapun. Password disimpan terenkripsi AES-256-GCM.
            </div>
          </div>
        )
      )}

      {/* ── Tab: Log Keluar ── */}
      {tab === "log" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={logFilter.status} onChange={(e) => setLogFilter((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Semua Status</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={logFilter.source} onChange={(e) => setLogFilter((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">Semua Source</option>
                  <option value="ssd">SSD</option>
                  <option value="sd">SD</option>
                  <option value="portal">Portal</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dari</label>
                <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={logFilter.from} onChange={(e) => setLogFilter((f) => ({ ...f, from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Sampai</label>
                <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={logFilter.to} onChange={(e) => setLogFilter((f) => ({ ...f, to: e.target.value }))} />
              </div>
              <Button onClick={() => void loadLogs(1)} className="bg-slate-700 hover:bg-slate-800 text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Terapkan
              </Button>
            </div>
          </div>

          {/* Delete by range */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Hapus log sebelum tanggal</p>
            <div className="flex gap-2 items-center flex-wrap">
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={deleteDate} onChange={(e) => { setDeleteDate(e.target.value); setDeleteConfirm(false); }} />
              {!deleteConfirm ? (
                <Button onClick={() => { if (!deleteDate) { showToast("error", "Pilih tanggal dulu"); return; } setDeleteConfirm(true); }}
                  className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Hapus
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">Yakin hapus semua log s.d. {deleteDate}?</span>
                  <Button onClick={() => void handleDelete()} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5">
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ya, hapus"}
                  </Button>
                  <button onClick={() => setDeleteConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2">Batal</button>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {logLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat log...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <List className="w-8 h-8 opacity-40" />
                <p className="text-sm">Belum ada log email</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Waktu</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kepada</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                          <td className="px-4 py-3 text-slate-700 text-xs whitespace-nowrap">{row.to}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">{row.subject}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[row.source] ?? "bg-slate-100 text-slate-600"}`}>
                              {SOURCE_LABELS[row.source] ?? row.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {row.status === "sent" ? (
                              <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500 text-xs font-medium" title={row.error ?? ""}>
                                <AlertCircle className="w-3.5 h-3.5" /> Failed
                                {row.error && <span className="text-slate-400 font-normal truncate max-w-32">— {row.error}</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400">Total {logTotal} log</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void loadLogs(logPage - 1)} disabled={logPage <= 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-slate-600">{logPage} / {logTotalPages}</span>
                      <button onClick={() => void loadLogs(logPage + 1)} disabled={logPage >= logTotalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
