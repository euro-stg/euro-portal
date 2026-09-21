"use client";

import { useRef, useState } from "react";
import { Eye, Upload, Loader2, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export type PreviewStamp = { text: string; positionXMm: number; positionYMm: number; fontSize?: number; color?: string };

// Preview stempel (posisi X/Y saat ini di form, belum perlu disimpan) di atas contoh PDF
// milik Category (diupload sekali, disimpan persisten di Nextcloud lewat
// /api/edoc/category/[id]/sample-pdf supaya tetap kelihatan tiap buka preview tanpa upload
// ulang), atau halaman A4 kosong berpenanda mm kalau Category belum punya contoh.
export function StampPreviewButton({
  stamps, disabled, categoryId, hasSample, onSampleChange,
}: {
  stamps: PreviewStamp[];
  disabled?: boolean;
  categoryId: string;
  hasSample: boolean;
  onSampleChange: (hasSample: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAndSaveSample = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/edoc/category/${categoryId}/sample-pdf`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.message || "Gagal menyimpan contoh PDF"); return; }
      onSampleChange(true);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeSample = async () => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/edoc/category/${categoryId}/sample-pdf`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.message || "Gagal menghapus contoh PDF"); return; }
      onSampleChange(false);
    } finally {
      setUploading(false);
    }
  };

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("stamps", JSON.stringify(stamps));
      fd.append("categoryId", categoryId);
      const res = await fetch("/api/edoc/stamp-preview", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message || "Gagal membuat preview");
        return;
      }
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void pickAndSaveSample(e.target.files?.[0] ?? null)} />
        {hasSample ? (
          <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
            <FileText className="w-3 h-3" /> Contoh PDF tersimpan
            <button type="button" title="Ganti contoh PDF" disabled={uploading} onClick={() => fileRef.current?.click()} className="hover:text-amber-600 ml-1">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            </button>
            <button type="button" title="Hapus contoh PDF" disabled={uploading} onClick={removeSample} className="hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
          </span>
        ) : (
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="text-xs text-slate-500 hover:text-amber-600 flex items-center gap-1">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload contoh PDF (opsional, tersimpan)
          </button>
        )}
        <Button size="sm" variant="outline" disabled={disabled || loading} onClick={runPreview} className="flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Preview
        </Button>
      </div>

      {error && !previewUrl && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <Modal open={!!previewUrl} onClose={close} title="Preview Posisi Stempel" boxClassName="max-w-3xl">
        {previewUrl ? (
          <iframe src={previewUrl} className="w-full h-[75vh] border border-slate-200 rounded-lg" title="Preview stempel" />
        ) : null}
      </Modal>
    </>
  );
}
