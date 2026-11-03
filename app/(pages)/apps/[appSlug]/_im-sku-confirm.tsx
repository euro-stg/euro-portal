"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";

// Layar konfirmasi import item IM berbasis SKU (2026-11-02) — dipakai import di detail IM,
// upload IM baru, dan Cocokkan & Import Item. Data dari POST /api/edoc/im-product/preview;
// tiap baris sudah divalidasi ke Master Item. Simpan DIBLOKIR kalau ada baris bermasalah
// (SKU kosong / tidak ada / Discontinued) — user memperbaiki Excel lalu upload ulang.

type MasterRef = { itemCode: string; itemName: string; company: string | null; business: string | null; itemGroup: string; status: string; standardPrice: number | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ImProduct = { itemName: string; sku: string | null; promoType: string | null; promoPrice: number | null; [k: string]: any };
export type PreviewRow = { index: number; product: ImProduct; excelName: string; sku: string | null; master: MasterRef | null; error: string | null; nameChanged: boolean };
export type ImportPreviewData = {
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number; renamed: number };
  warnings?: string[];
};
export type ConfirmedRowPayload = { product: ImProduct };

const rupiah = (n: number | null) => (n == null ? "" : `Rp${n.toLocaleString("id-ID")}`);

/** Baris siap kirim — hanya kalau tidak ada yang bermasalah. */
export function confirmedRows(preview: ImportPreviewData): ConfirmedRowPayload[] | null {
  return preview.summary.invalid === 0 ? preview.rows.map((r) => ({ product: r.product })) : null;
}

export function ImSkuConfirm({ preview, saving = false, onSubmit, onCancel, submitLabel = "Simpan", readOnly = false }: {
  preview: ImportPreviewData; saving?: boolean;
  onSubmit?: (rows: ConfirmedRowPayload[]) => void; onCancel: () => void; submitLabel?: string; readOnly?: boolean;
}) {
  const { summary } = preview;
  const [filter, setFilter] = useState<"all" | "invalid" | "renamed">(summary.invalid > 0 ? "invalid" : "all");
  const visible = useMemo(() => preview.rows.filter((r) =>
    filter === "all" || (filter === "invalid" ? !!r.error : r.nameChanged)), [preview.rows, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-slate-600"><b>{summary.total}</b> baris</span>
        <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> {summary.valid} valid</span>
        {summary.invalid > 0 && <span className="flex items-center gap-1 text-red-700"><AlertTriangle className="w-4 h-4" /> {summary.invalid} bermasalah</span>}
        {summary.renamed > 0 && <span className="flex items-center gap-1 text-blue-700"><PencilLine className="w-4 h-4" /> {summary.renamed} nama disesuaikan</span>}
        <div className="ml-auto flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
          {([["all", "Semua"], ["invalid", "Bermasalah"], ["renamed", "Nama disesuaikan"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1 rounded-md ${filter === v ? "bg-white shadow-sm text-slate-800 font-medium" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
      </div>
      {!!preview.warnings?.length && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
          {preview.warnings.slice(0, 5).map((w, i) => <p key={i}>⚠ {w}</p>)}
          {preview.warnings.length > 5 && <p>… dan {preview.warnings.length - 5} peringatan lain</p>}
        </div>
      )}

      <div className="max-h-[55vh] overflow-auto border border-slate-200 rounded-lg">
        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Tidak ada baris untuk filter ini.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-slate-500 border-b border-slate-200">
                {["#", "SKU", "Nama Item", "Company", "Promo", "Status"].map((h) => <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.index} className={r.error ? "bg-red-50/50" : ""}>
                  <td className="px-3 py-2 text-slate-400">{r.index + 1}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{r.sku ?? <span className="text-red-600 font-sans">kosong</span>}</td>
                  <td className="px-3 py-2">
                    <p className="text-slate-800">{r.product.itemName}</p>
                    {r.nameChanged && <p className="text-[11px] text-blue-700">di Excel: {r.excelName}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.master?.company ?? "-"}{r.master?.business ? ` · ${r.master.business}` : ""}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{[r.product.promoType, rupiah(r.product.promoPrice)].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.error
                      ? <span className="text-red-700">{r.error}</span>
                      : <span className="text-emerald-700">Valid{r.nameChanged ? " · nama disesuaikan" : ""}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        {summary.invalid > 0 && (
          <p className="text-xs text-red-700 mr-auto">
            {summary.invalid} baris bermasalah — perbaiki SKU-nya di Excel lalu upload ulang. Nama item mengikuti Master Item otomatis.
          </p>
        )}
        <Button variant="outline" onClick={onCancel} disabled={saving}>{readOnly ? "Tutup" : "Batal"}</Button>
        {!readOnly && (
          <Button onClick={() => { const rows = confirmedRows(preview); if (rows) onSubmit?.(rows); }} disabled={saving || summary.invalid > 0} className="flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {submitLabel} ({summary.total} item)
          </Button>
        )}
      </div>
    </div>
  );
}
