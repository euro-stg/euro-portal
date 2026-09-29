"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, Download, Tags, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

type PricelistFile = {
  id: string; businessUnitCode: string; fileName: string; uploadedAt: string;
  uploader: { id: string; name: string | null } | null;
};
type BusinessUnit = { id: string; code: string; name: string; status: string };

const fmtDateTime = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

// Master Pricelist Category IM — SIFATNYA LAMPIRAN FILE PER BUSINESS UNIT (2026-09-29, revisi
// dari desain sebelumnya yang sempat memparsing isi Excel jadi item terstruktur). Tidak ada
// parsing sama sekali di sini — admin cukup pilih BU, lihat file yang sedang aktif (kalau ada),
// download untuk cek isinya, atau upload file baru untuk MENGGANTI yang lama. User yang sedang
// import item ke sebuah file IM bisa download file BU-nya sendiri sebagai acuan (lihat tombol
// "Download Pricelist" di halaman Import Item).
export function ImPricelistManager({
  businessUnits, onError, onSuccess,
}: {
  businessUnits: BusinessUnit[]; onError: (m: string) => void; onSuccess: (m: string) => void;
}) {
  const activeBUs = businessUnits.filter((b) => b.status === "active");
  const [selectedBU, setSelectedBU] = useState("");
  const [file, setFile] = useState<PricelistFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Default ke BU pertama begitu daftar BU termuat — biar tidak kosong melompong saat halaman dibuka.
  useEffect(() => { if (!selectedBU && activeBUs.length > 0) setSelectedBU(activeBUs[0].code); }, [activeBUs, selectedBU]);

  const load = useCallback(async (bu: string) => {
    if (!bu) { setFile(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/edoc/im-pricelist?businessUnitCode=${encodeURIComponent(bu)}`);
      const json = await res.json();
      setFile(res.ok ? (json.data ?? null) : null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(selectedBU); }, [selectedBU, load]);

  const handleUpload = async (f: File) => {
    if (!selectedBU) { onError("Pilih Business Unit dulu"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("businessUnitCode", selectedBU);
      const res = await fetch("/api/edoc/im-pricelist", { method: "PUT", body: fd });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal upload"); return; }
      onSuccess(`File pricelist ${selectedBU} berhasil diupload`);
      void load(selectedBU);
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/edoc/im-pricelist/download?businessUnitCode=${encodeURIComponent(selectedBU)}`);
      if (!res.ok) { const json = await res.json().catch(() => null); onError(json?.message || "Gagal download"); return; }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = match?.[1] || (file?.fileName ?? "Master Pricelist.xlsx");
      a.click();
      URL.revokeObjectURL(objUrl);
    } finally { setDownloading(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1"><Tags className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-slate-700">Master Pricelist (Category IM)</p></div>
      <p className="text-xs text-slate-400 mb-4">
        Terpisah per Business Unit — pilih BU dulu, lalu upload file Excel pricelist-nya. Upload ulang akan MENGGANTI file
        sebelumnya. File ini murni lampiran referensi (tidak diparsing/divalidasi) — user yang import item ke file IM bisa
        download file BU-nya sendiri sebagai acuan mengisi template.
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white" value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
          <option value="">Pilih Business Unit...</option>
          {activeBUs.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
        </select>
        <input ref={uploadRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }} />
        <Button variant="outline" size="sm" disabled={!selectedBU || uploading} onClick={() => uploadRef.current?.click()} className="flex items-center gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {file ? "Ganti File" : "Upload Excel"}
        </Button>
      </div>

      {!selectedBU ? (
        <p className="text-sm text-slate-400">Pilih Business Unit untuk melihat/mengelola file pricelist-nya.</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !file ? (
        <p className="text-sm text-slate-400">Belum ada file pricelist untuk {selectedBU}.</p>
      ) : (
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{file.fileName}</p>
              <p className="text-xs text-slate-400">
                Diupload {fmtDateTime(file.uploadedAt)}{file.uploader?.name ? ` oleh ${file.uploader.name}` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={downloading} onClick={handleDownload} className="flex items-center gap-2 shrink-0">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
          </Button>
        </div>
      )}
    </div>
  );
}
