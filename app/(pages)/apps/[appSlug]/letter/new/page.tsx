"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileSignature, Upload, Loader2, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Category = { id: string; code: string; name: string; hasDraft: boolean };
type Department = { id: string; code: string; name: string };
type Company = { id: string; code: string; name: string };

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white transition-colors";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

export default function NewLetterPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const [form, setForm] = useState({
    title: "", content: "", categoryId: "", departmentId: "", companyId: "", fileDraft: "",
  });
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ssd/category").then((r) => r.json()),
      fetch("/api/ssd/department").then((r) => r.json()),
      fetch("/api/company").then((r) => r.json()),
    ]).then(([cat, dept, comp]) => {
      setCategories(cat.data ?? []);
      setDepartments(dept.data ?? []);
      setCompanies((comp.data ?? []).filter((c: Company & { status: string }) => c.status === "active"));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const selectedCategory = categories.find((c) => c.id === form.categoryId);

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { showToast("error", "File maksimal 10MB"); return; }
    setDraftFile(file);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("prefix", "draft");
      const res = await fetch("/api/ssd/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Upload gagal"); setDraftFile(null); return; }
      setForm((f) => ({ ...f, fileDraft: json.path }));
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast("error", "Judul wajib diisi"); return; }
    if (!form.content.trim()) { showToast("error", "Isi surat wajib diisi"); return; }
    if (!form.categoryId) { showToast("error", "Pilih kategori"); return; }
    if (!form.departmentId) { showToast("error", "Pilih departemen"); return; }
    if (!form.companyId) { showToast("error", "Pilih perusahaan"); return; }
    if (selectedCategory?.hasDraft && !form.fileDraft) { showToast("error", "Upload file draft terlebih dahulu"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ssd/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal membuat surat"); return; }
      router.push(`/apps/${appSlug}/letter/${json.data.id}`);
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <FileSignature className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Buat Surat Baru</h1>
            <p className="text-xs text-slate-400">Isi formulir dan ajukan untuk persetujuan</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-slate-200 p-6">
        {/* Judul */}
        <div>
          <label className={labelCls}>Judul Surat <span className="text-red-500">*</span></label>
          <input
            className={inputCls}
            placeholder="Contoh: Undangan Rapat Koordinasi..."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Kategori, Departemen, Perusahaan */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Kategori <span className="text-red-500">*</span></label>
            <select
              className={inputCls}
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, fileDraft: "" }))}
            >
              <option value="">Pilih...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Departemen <span className="text-red-500">*</span></label>
            <select
              className={inputCls}
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">Pilih...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Perusahaan <span className="text-red-500">*</span></label>
            <select
              className={inputCls}
              value={form.companyId}
              onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
            >
              <option value="">Pilih...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Isi surat */}
        <div>
          <label className={labelCls}>Isi Surat <span className="text-red-500">*</span></label>
          <textarea
            className={`${inputCls} min-h-[160px] resize-y`}
            placeholder="Tuliskan isi surat..."
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
        </div>

        {/* Upload file draft — hanya jika kategori hasDraft */}
        {selectedCategory?.hasDraft && (
          <div>
            <label className={labelCls}>
              File Draft <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-slate-400 font-normal">Maks. 10MB</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelect(f); }}
            />
            {form.fileDraft ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{draftFile?.name ?? form.fileDraft}</p>
                  <p className="text-xs text-green-600 font-mono truncate">{form.fileDraft}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDraftFile(null); setForm((f) => ({ ...f, fileDraft: "" })); if (fileRef.current) fileRef.current.value = ""; }}
                  className="p-1 text-green-600 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Mengupload..." : "Klik untuk upload file draft"}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={submitting || uploading}
            className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Menyimpan..." : "Simpan sebagai Draft"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
