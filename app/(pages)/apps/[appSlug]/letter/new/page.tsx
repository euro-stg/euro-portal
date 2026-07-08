"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileSignature, Upload, Loader2, ArrowLeft, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Category   = { id: string; code: string; name: string; hasDraft: boolean };
type Company    = { id: string; code: string; name: string };
type UserOption = { id: string; name: string | null; employeeId: string; jobPositionName: string | null };
type OrgInfo    = { id: string; name: string; code: string | null; parentOrganizationId: string | null } | null;

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white transition-colors";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

export default function NewLetterPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [categories,  setCategories]  = useState<Category[]>([]);
  const [companies,   setCompanies]   = useState<Company[]>([]);
  const [users,       setUsers]       = useState<UserOption[]>([]);
  const [orgInfo,     setOrgInfo]     = useState<OrgInfo>(undefined as unknown as OrgInfo);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const [form, setForm] = useState({
    title: "", tujuan: "", categoryId: "", companyId: "", picId: "", fileDraft: "",
  });
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [picSearch, setPicSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ssd/category").then((r) => r.json()),
      fetch("/api/company").then((r) => r.json()),
      fetch("/api/user/list?all=true&status=active").then((r) => r.json()),
      fetch("/api/ssd/org-admin/me").then((r) => r.json()),
    ]).then(([cat, comp, usr, me]) => {
      setCategories(cat.data ?? []);
      setCompanies((comp.data ?? []).filter((c: Company & { status: string }) => c.status === "active"));
      setUsers(usr.data ?? []);
      setOrgInfo((me.data as { organization: OrgInfo })?.organization ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const selectedPic      = users.find((u) => u.id === form.picId);

  const filteredUsers = picSearch.trim()
    ? users.filter((u) =>
        (u.name ?? "").toLowerCase().includes(picSearch.toLowerCase()) ||
        u.employeeId.toLowerCase().includes(picSearch.toLowerCase())
      )
    : users;

  const doSave = async (fileDraftPath: string) => {
    const current = { ...form, fileDraft: fileDraftPath };
    if (!current.title.trim())  { showToast("error", "Perihal wajib diisi"); return; }
    if (!current.categoryId)    { showToast("error", "Pilih kategori"); return; }
    if (!current.companyId)     { showToast("error", "Pilih perusahaan"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ssd/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: current.title,
          tujuan: current.tujuan || null,
          picId: current.picId || null,
          categoryId: current.categoryId,
          companyId: current.companyId,
          fileDraft: fileDraftPath || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal membuat surat"); return; }
      router.push(`/apps/${appSlug}/letter/${json.data.id}`);
    } finally { setSubmitting(false); }
  };

  const handleFileSelect = async (file: File) => {
    if (!form.title.trim())   { showToast("error", "Isi Perihal terlebih dahulu"); return; }
    if (!form.categoryId)     { showToast("error", "Pilih kategori terlebih dahulu"); return; }
    if (!form.companyId)      { showToast("error", "Pilih perusahaan terlebih dahulu"); return; }
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
      await doSave(json.path);
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategory?.hasDraft) { showToast("error", "Upload file draft terlebih dahulu"); return; }
    await doSave("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  return (
    <div>
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
            <p className="text-xs text-slate-400">Isi formulir dan simpan sebagai draft</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-slate-200 p-6">

        {/* Org info banner */}
        {orgInfo === null ? (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Anda belum di-assign ke organisasi SSD. Hubungi admin untuk mendapatkan akses.
          </div>
        ) : orgInfo && !orgInfo.code ? (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Kode organisasi <span className="font-semibold">{orgInfo.name}</span> belum diset. Hubungi admin untuk mengisi kode org/sub-org sebelum membuat surat.
          </div>
        ) : orgInfo ? (
          <div className="px-4 py-2.5 bg-violet-50 border border-violet-100 rounded-lg flex items-center gap-2 text-sm">
            <span className="font-mono text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">{orgInfo.code}</span>
            <span className="text-slate-600">{orgInfo.name}</span>
            <span className="text-xs text-slate-400 ml-auto">{orgInfo.parentOrganizationId ? "Sub-Org" : "Org"}</span>
          </div>
        ) : null}

        {/* Row 1: Kategori, Perusahaan */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Kategori Surat <span className="text-red-500">*</span></label>
            <select
              className={inputCls}
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, fileDraft: "" }))}
            >
              <option value="">Pilih kategori...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
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
              <option value="">Pilih perusahaan...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Perihal */}
        <div>
          <label className={labelCls}>Perihal <span className="text-red-500">*</span></label>
          <input
            className={inputCls}
            placeholder="Contoh: Undangan Rapat Koordinasi Q3 2026"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Row 3: Tujuan + PIC */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tujuan</label>
            <input
              className={inputCls}
              placeholder="Contoh: Direktur Operasional / Seluruh Karyawan"
              value={form.tujuan}
              onChange={(e) => setForm((f) => ({ ...f, tujuan: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>PIC</label>
            {selectedPic ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-violet-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-violet-800 truncate">{selectedPic.name}</p>
                  <p className="text-xs text-violet-500">{selectedPic.employeeId}{selectedPic.jobPositionName ? ` · ${selectedPic.jobPositionName}` : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, picId: "" })); setPicSearch(""); }}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Cari nama atau NIK..."
                  value={picSearch}
                  onChange={(e) => setPicSearch(e.target.value)}
                />
                {picSearch.trim() && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</p>
                    ) : (
                      filteredUsers.slice(0, 10).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setForm((f) => ({ ...f, picId: u.id })); setPicSearch(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-violet-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-800">{u.name ?? "-"}</p>
                          <p className="text-xs text-slate-400">{u.employeeId}{u.jobPositionName ? ` · ${u.jobPositionName}` : ""}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* File Draft — hanya jika kategori hasDraft */}
        {selectedCategory?.hasDraft && (
          <div>
            <label className={labelCls}>
              File Draft <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-slate-400 font-normal">PDF, Word, atau Gambar · Maks. 10MB</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
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
            disabled={submitting || uploading || !orgInfo?.code}
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
