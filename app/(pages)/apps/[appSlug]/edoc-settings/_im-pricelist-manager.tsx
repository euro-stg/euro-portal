"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, Download, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

type PricelistItem = {
  id: string; itemName: string; category: string | null; discountClass: string | null;
  packaging: string | null; normalPrice: number | null; notes: string | null; updatedAt: string;
};

const fmtRupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);

// Master Pricelist Category IM — sumber tab "Pricelist" yang dibundel ke template
// "Download Template" di halaman detail tiap file IM. Import Excel di sini meng-upsert
// by nama item (re-import tidak menduplikasi, cukup update baris yang sudah ada).
export function ImPricelistManager({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [items, setItems] = useState<PricelistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/im-pricelist");
      const json = await res.json();
      setItems(res.ok ? (json.data ?? []) : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/edoc/im-pricelist", { method: "PUT", body: fd });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal import"); return; }
      onSuccess(`${json.imported} item pricelist berhasil diimport/diperbarui`);
      void load();
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/edoc/im-pricelist/template");
      if (!res.ok) { onError("Gagal download template"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template Master Pricelist.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Tags className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-slate-700">Master Pricelist (Category IM)</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={handleDownloadTemplate} className="flex items-center gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Template
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }} />
          <Button variant="outline" size="sm" disabled={importing} onClick={() => importRef.current?.click()} className="flex items-center gap-2">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import Excel
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Sumber data untuk tab &ldquo;Pricelist&rdquo; yang otomatis dibundel ke tombol &ldquo;Download Template&rdquo; di halaman detail tiap file Category IM.
        &ldquo;Download Template&rdquo; di sini berisi data yang sudah ada (kalau ada) — tinggal edit/tambah baris lalu upload ulang. Item dengan nama yang sama akan diperbarui, bukan diduplikasi.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada data pricelist.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-1.5 pr-3 font-medium">Item Name</th>
                <th className="py-1.5 pr-3 font-medium">Category</th>
                <th className="py-1.5 pr-3 font-medium">Discount Class</th>
                <th className="py-1.5 pr-3 font-medium">Packaging</th>
                <th className="py-1.5 pr-3 font-medium">Harga Normal</th>
                <th className="py-1.5 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="py-1.5 pr-3 text-slate-700">{p.itemName}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{p.category ?? "-"}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{p.discountClass ?? "-"}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{p.packaging ?? "-"}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{fmtRupiah(p.normalPrice)}</td>
                  <td className="py-1.5 text-slate-400">{p.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
