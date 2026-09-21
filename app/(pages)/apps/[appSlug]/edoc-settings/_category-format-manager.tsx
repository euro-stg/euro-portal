"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Tag, Hash, Trash2, Save, Stamp, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StampPreviewButton } from "./_stamp-preview-button";

type CategoryType = { id: string; code: string; name: string };
type Category = { id: string; code: string; name: string; categoryTypes: CategoryType[]; samplePdfPath?: string | null };
type Segment = { segmentType: string; literalValue?: string | null; separatorAfter?: string };
type NumberFormat = {
  sequenceScope: string; segments: Segment[];
  positionXMm: number | null; positionYMm: number | null; fontSize: number | null;
} | null;
type WatermarkConfig = { text: string; color: string; positionXMm: number; positionYMm: number; fontSize: number } | null;

const inputCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

const SEGMENT_TYPES = [
  "LITERAL_TEXT", "SEQUENCE", "CATEGORY_CODE", "CATEGORY_TYPE_CODE",
  "ORG_DEPT_CODE", "MONTH_ROMAN", "YEAR", "REF_MAIN_DOCUMENT_NUMBER",
];

// Label + contoh hasil untuk tiap jenis segmen — biar tidak perlu menebak arti nama enum-nya.
const SEGMENT_INFO: Record<string, { label: string; example: string }> = {
  LITERAL_TEXT: { label: "Teks tetap (Anda isi sendiri)", example: '"Euromedica" atau "MOC"' },
  SEQUENCE: { label: "Nomor urut (otomatis, +1 tiap approve)", example: "486, 487, 488, ..." },
  CATEGORY_CODE: { label: "Kode Category", example: "IM" },
  CATEGORY_TYPE_CODE: { label: "Kode Category Type", example: "regular" },
  ORG_DEPT_CODE: { label: "Kode Organisasi/Departemen file", example: "BUS" },
  MONTH_ROMAN: { label: "Bulan approve (angka romawi)", example: "VII" },
  YEAR: { label: "Tahun approve", example: "2026" },
  REF_MAIN_DOCUMENT_NUMBER: { label: "Rujuk balik ke Document Number file ini (khusus MOC)", example: "486/Euromedica/IM/BUS/VII/2026" },
};

export function CategoryFormatManager({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/category");
      const json = await res.json();
      setCategories(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createCategory = async () => {
    if (!newCode.trim() || !newName.trim()) { onError("Code dan name wajib diisi"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/edoc/category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: newCode.trim(), name: newName.trim() }) });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal membuat Category"); return; }
      setNewCode(""); setNewName("");
      onSuccess("Category berhasil dibuat");
      void load();
    } finally { setCreating(false); }
  };

  const toggleOpen = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1"><Tag className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-slate-700">Category &amp; Number Format</p></div>
      <p className="text-xs text-slate-400 mb-4">Buat Category di bawah, lalu <b>klik nama Category-nya</b> untuk buka/tutup pengaturan Category Type, format nomor, dan watermark-nya.</p>

      <div className="flex gap-2 mb-4">
        <input className={inputCls} placeholder="Code (mis. IM)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
        <input className={inputCls} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button size="sm" variant="outline" disabled={creating} onClick={createCategory} className="flex items-center gap-1 shrink-0">
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Category
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada Category.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => {
            const isOpen = openIds.has(c.id);
            return (
              <div key={c.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleOpen(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${isOpen ? "bg-amber-50" : "hover:bg-slate-50"}`}
                >
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <span className={`text-sm ${isOpen ? "text-amber-700 font-medium" : "text-slate-600"}`}>{c.code}</span>
                  <span className="text-xs text-slate-400">— {c.name}</span>
                </button>

                {isOpen && (
                  <div className="p-4 border-t border-slate-200 space-y-4">
                    <CategoryTypeEditor category={c} onChanged={load} onError={onError} onSuccess={onSuccess} />
                    <NumberFormatEditor categoryId={c.id} type="DOCUMENT_NUMBER" title="Document Number (wajib sebelum file bisa di-approve)" hasSample={!!c.samplePdfPath} onSampleChange={load} onError={onError} onSuccess={onSuccess} />
                    <NumberFormatEditor categoryId={c.id} type="MOC_NUMBER" title="MOC Number (opsional — kalau kosong, file di Category ini tidak akan punya opsi generate MOC)" hasSample={!!c.samplePdfPath} onSampleChange={load} onError={onError} onSuccess={onSuccess} />
                    <WatermarkEditor categoryId={c.id} hasSample={!!c.samplePdfPath} onSampleChange={load} onError={onError} onSuccess={onSuccess} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryTypeEditor({ category, onChanged, onError, onSuccess }: { category: Category; onChanged: () => void; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!code.trim() || !name.trim()) { onError("Code dan name Category Type wajib diisi"); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/edoc/category/${category.id}/type`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim(), name: name.trim() }) });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menambah Category Type"); return; }
      setCode(""); setName("");
      onSuccess("Category Type ditambahkan");
      onChanged();
    } finally { setAdding(false); }
  };

  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs font-medium text-slate-500 mb-2">Category Type untuk {category.code}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {category.categoryTypes.map((t) => (
          <span key={t.id} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded">{t.code} — {t.name}</span>
        ))}
        {category.categoryTypes.length === 0 && <span className="text-xs text-slate-400">Belum ada</span>}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Code (mis. regular)" value={code} onChange={(e) => setCode(e.target.value)} />
        <input className={inputCls} placeholder="Name (mis. Regular)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" variant="outline" disabled={adding} onClick={add} className="shrink-0">{adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}</Button>
      </div>
    </div>
  );
}

function NumberFormatEditor({ categoryId, type, title, hasSample, onSampleChange, onError, onSuccess }: { categoryId: string; type: "DOCUMENT_NUMBER" | "MOC_NUMBER"; title: string; hasSample: boolean; onSampleChange: () => void; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [format, setFormat] = useState<NumberFormat>(null);
  const [sequenceScope, setSequenceScope] = useState("GLOBAL");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [positionXMm, setPositionXMm] = useState("");
  const [positionYMm, setPositionYMm] = useState("");
  const [fontSize, setFontSize] = useState("11");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/edoc/number-format?categoryId=${categoryId}&type=${type}`);
      const json = await res.json();
      const f: NumberFormat = json.data;
      setFormat(f);
      setSequenceScope(f?.sequenceScope ?? "GLOBAL");
      setSegments(f?.segments.map((s) => ({ segmentType: s.segmentType, literalValue: s.literalValue, separatorAfter: s.separatorAfter ?? "/" })) ?? []);
      setPositionXMm(f?.positionXMm != null ? String(f.positionXMm) : "");
      setPositionYMm(f?.positionYMm != null ? String(f.positionYMm) : "");
      setFontSize(f?.fontSize != null ? String(f.fontSize) : "11");
    } finally { setLoading(false); }
  }, [categoryId, type]);

  useEffect(() => { void load(); }, [load]);

  const addSegment = () => setSegments((s) => [...s, { segmentType: "LITERAL_TEXT", literalValue: "", separatorAfter: "/" }]);
  const removeSegment = (i: number) => setSegments((s) => s.filter((_, idx) => idx !== i));
  const updateSegment = (i: number, patch: Partial<Segment>) => setSegments((s) => s.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)));

  const save = async () => {
    if (segments.length === 0) { onError("Minimal 1 segment"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/edoc/number-format", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId, type, sequenceScope, segments,
          positionXMm: positionXMm ? Number(positionXMm) : undefined,
          positionYMm: positionYMm ? Number(positionYMm) : undefined,
          fontSize: fontSize ? Number(fontSize) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menyimpan format"); return; }
      onSuccess(`Format ${title} tersimpan`);
      void load();
    } finally { setSaving(false); }
  };

  const preview = segments.reduce((acc, s, i) => {
    const value = s.segmentType === "LITERAL_TEXT" ? (s.literalValue || "?") : `{${s.segmentType}}`;
    const sep = i < segments.length - 1 ? (s.separatorAfter ?? "/") : "";
    return acc + value + sep;
  }, "");

  if (loading) return <div className="flex items-center justify-center py-4 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Hash className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        {!format && <span className="text-xs text-slate-400">(belum dikonfigurasi)</span>}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Sequence Scope</label>
          <div className="flex gap-1">
            {["GLOBAL", "PER_CATEGORY"].map((s) => (
              <button key={s} onClick={() => setSequenceScope(s)} className={`px-2 py-1 rounded text-xs border transition-colors ${sequenceScope === s ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-2">
        {segments.map((seg, i) => (
          <div key={i}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
              <select className={`${inputCls} flex-1`} value={seg.segmentType} onChange={(e) => updateSegment(i, { segmentType: e.target.value })}>
                {SEGMENT_TYPES.map((t) => <option key={t} value={t}>{SEGMENT_INFO[t]?.label ?? t}</option>)}
              </select>
              {seg.segmentType === "LITERAL_TEXT" && (
                <input className={`${inputCls} flex-1`} placeholder="Teks tetap" value={seg.literalValue ?? ""} onChange={(e) => updateSegment(i, { literalValue: e.target.value })} />
              )}
              <button onClick={() => removeSegment(i)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-1.5 pl-6 mt-1">
              <p className="text-xs text-slate-400 flex-1">Contoh hasil: {SEGMENT_INFO[seg.segmentType]?.example}</p>
              {i < segments.length - 1 && (
                <label className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                  Disambung dengan
                  <input
                    className={`${inputCls} w-12 text-center`}
                    value={seg.separatorAfter ?? "/"}
                    onChange={(e) => updateSegment(i, { separatorAfter: e.target.value })}
                    placeholder="/"
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      <button onClick={addSegment} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-3"><Plus className="w-3.5 h-3.5" /> Tambah Segment</button>

      {segments.length > 0 && <p className="text-xs font-mono text-slate-400 mb-3">Preview: {preview}</p>}

      <div className="flex items-end gap-3 mb-3 pt-3 border-t border-slate-100">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Posisi X (mm dari kiri, A4)</label>
          <input type="number" step="0.1" className={`${inputCls} w-28`} placeholder="mis. 100" value={positionXMm} onChange={(e) => setPositionXMm(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Posisi Y (mm dari atas, A4)</label>
          <input type="number" step="0.1" className={`${inputCls} w-28`} placeholder="mis. 30" value={positionYMm} onChange={(e) => setPositionYMm(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Font Size</label>
          <input type="number" step="0.5" className={`${inputCls} w-20`} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
        </div>
      </div>
      {(!positionXMm || !positionYMm) && (
        <p className="text-xs text-amber-600 mb-3">Posisi belum diisi — nomor tidak akan distempel ke PDF sampai posisi X/Y diisi.</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
        </Button>
        <StampPreviewButton
          disabled={!positionXMm || !positionYMm}
          stamps={[{ text: preview || "(isi minimal 1 segment)", positionXMm: Number(positionXMm), positionYMm: Number(positionYMm), fontSize: Number(fontSize) || 11 }]}
          categoryId={categoryId}
          hasSample={hasSample}
          onSampleChange={onSampleChange}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1.5">Preview pakai contoh teks dari segmen di atas (bukan nomor asli — nomor urut/tanggal beneran baru terisi saat file di-approve).</p>
    </div>
  );
}

function WatermarkEditor({ categoryId, hasSample, onSampleChange, onError, onSuccess }: { categoryId: string; hasSample: boolean; onSampleChange: () => void; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("green");
  const [positionXMm, setPositionXMm] = useState("");
  const [positionYMm, setPositionYMm] = useState("");
  const [fontSize, setFontSize] = useState("24");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/edoc/watermark?categoryId=${categoryId}`);
      const json = await res.json();
      const w: WatermarkConfig = json.data;
      setText(w?.text ?? "");
      setColor(w?.color ?? "green");
      setPositionXMm(w?.positionXMm != null ? String(w.positionXMm) : "");
      setPositionYMm(w?.positionYMm != null ? String(w.positionYMm) : "");
      setFontSize(w?.fontSize != null ? String(w.fontSize) : "24");
    } finally { setLoading(false); }
  }, [categoryId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!text.trim()) { onError("Teks watermark wajib diisi"); return; }
    if (!positionXMm || !positionYMm) { onError("Posisi X/Y watermark wajib diisi"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/edoc/watermark", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, text, color, positionXMm: Number(positionXMm), positionYMm: Number(positionYMm), fontSize: Number(fontSize) }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menyimpan watermark"); return; }
      onSuccess("Watermark tersimpan");
      void load();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-4 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Stamp className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-600">Watermark (opsional — mis. &ldquo;APPROVED&rdquo;)</p>
        {!text && <span className="text-xs text-slate-400">(belum dikonfigurasi)</span>}
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Teks</label>
          <input className={`${inputCls} w-32`} placeholder="mis. APPROVED" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Warna</label>
          <select className={inputCls} value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
            <option value="black">Black</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Posisi X (mm)</label>
          <input type="number" step="0.1" className={`${inputCls} w-24`} value={positionXMm} onChange={(e) => setPositionXMm(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Posisi Y (mm)</label>
          <input type="number" step="0.1" className={`${inputCls} w-24`} value={positionYMm} onChange={(e) => setPositionYMm(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Font Size</label>
          <input type="number" step="0.5" className={`${inputCls} w-20`} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <Button size="sm" onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
        </Button>
        <StampPreviewButton
          disabled={!text.trim() || !positionXMm || !positionYMm}
          stamps={[{ text: text || "APPROVED", positionXMm: Number(positionXMm), positionYMm: Number(positionYMm), fontSize: Number(fontSize) || 24, color }]}
          categoryId={categoryId}
          hasSample={hasSample}
          onSampleChange={onSampleChange}
        />
      </div>
    </div>
  );
}
