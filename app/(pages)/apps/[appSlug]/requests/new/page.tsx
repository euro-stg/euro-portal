"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppOption = { id: string; name: string };

const inputCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

export default function NewRequestPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [form, setForm] = useState({
    type: "NEW_APP",
    title: "",
    description: "",
    refAppId: "",
    estimatedCompletedAt: "",
  });
  const [apps, setApps] = useState<AppOption[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load available apps for CHANGE_REQUEST
    fetch("/api/module/list?type=app")
      .then((r) => r.json())
      .then((j) => setApps(j.data ?? []))
      .catch(() => {});
  }, []);

  const submit = async (asDraft: boolean) => {
    setError(null);
    if (!form.title.trim()) { setError("Judul wajib diisi"); return; }
    if (!form.description.trim()) { setError("Deskripsi wajib diisi"); return; }
    if (form.type === "CHANGE_REQUEST" && !form.refAppId) { setError("Pilih aplikasi yang akan diubah"); return; }

    setSaving(true);
    try {
      // Selalu buat sebagai DRAFT dulu
      const res = await fetch("/api/sd/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          refAppId: form.refAppId || null,
          estimatedCompletedAt: form.estimatedCompletedAt || null,
          status: "DRAFT",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal menyimpan");

      // Upload lampiran jika ada
      if (files.length > 0) {
        await Promise.all(files.map((file) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("category", "REQUEST");
          return fetch(`/api/sd/request/${json.data.id}/upload`, { method: "POST", body: fd });
        }));
      }

      // Jika bukan draft, transisi ke SUBMITTED agar approval workflow dibuat
      if (!asDraft) {
        const submitRes = await fetch(`/api/sd/request/${json.data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SUBMITTED", note: "Pengajuan disubmit" }),
        });
        if (!submitRes.ok) {
          const sj = await submitRes.json();
          throw new Error(sj.message ?? "Gagal submit pengajuan");
        }
      }

      router.push(`/apps/${appSlug}/requests/${json.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Buat Pengajuan</h1>
          <p className="text-sm text-slate-400">Isi form kebutuhan pengembangan aplikasi</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Tipe */}
        <div>
          <label className={labelCls}>Tipe Pengajuan</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "NEW_APP", label: "Aplikasi Baru", desc: "Pengembangan aplikasi baru dari awal" },
              { value: "CHANGE_REQUEST", label: "Perubahan", desc: "Perubahan pada aplikasi yang sudah ada" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: opt.value, refAppId: "" }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  form.type === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`text-sm font-semibold ${form.type === opt.value ? "text-blue-700" : "text-slate-700"}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Ref App (for CHANGE_REQUEST) */}
        {form.type === "CHANGE_REQUEST" && (
          <div>
            <label className={labelCls}>Aplikasi yang Diubah</label>
            <select
              className={inputCls}
              value={form.refAppId}
              onChange={(e) => setForm((f) => ({ ...f, refAppId: e.target.value }))}
            >
              <option value="">Pilih aplikasi...</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Judul */}
        <div>
          <label className={labelCls}>Judul Pengajuan</label>
          <input
            className={inputCls}
            placeholder={form.type === "NEW_APP" ? "e.g. Aplikasi Cuti Karyawan" : "e.g. Tambah fitur export Excel"}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Deskripsi */}
        <div>
          <label className={labelCls}>Deskripsi Kebutuhan</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={6}
            placeholder="Jelaskan secara detail apa yang dibutuhkan, siapa yang akan menggunakan, proses bisnis yang terlibat, dan hasil yang diharapkan..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">
            Deskripsi yang detail membantu tim IT memahami kebutuhan dengan lebih baik.
          </p>
        </div>

        {/* Estimasi Selesai */}
        <div>
          <label className={labelCls}>Estimasi Selesai (opsional)</label>
          <input
            type="date"
            className={inputCls}
            value={form.estimatedCompletedAt}
            onChange={(e) => setForm((f) => ({ ...f, estimatedCompletedAt: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">
            Tanggal target selesai. Jika tidak ditentukan, IT akan memberikan estimasi.
          </p>
        </div>

        {/* Lampiran */}
        <div>
          <label className={labelCls}>Lampiran (opsional)</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked]);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
          >
            <Paperclip className="w-4 h-4" />
            Pilih file (PDF, Word, Gambar — maks 10MB per file)
          </button>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                  <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          onClick={() => submit(true)}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Simpan sebagai Draft
        </Button>
        <Button
          onClick={() => submit(false)}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit Pengajuan
        </Button>
      </div>
    </div>
  );
}
