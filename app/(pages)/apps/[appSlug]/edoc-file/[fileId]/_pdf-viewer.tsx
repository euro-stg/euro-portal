"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, Download, Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { EDOC_VIEWER_HEADER } from "@/lib/edoc-viewer";

// Viewer PDF internal (2026-10-07) — pengganti viewer bawaan browser yang selalu punya tombol
// download/print. Halaman digambar sendiri ke <canvas> pakai pdf.js + text layer (teks tetap
// bisa diblok/di-copy, keputusan user). Download/print/klik kanan diblokir di sini; download
// asli cuma lewat tombol Download (muncul kalau canDownload) yang juga dicek ulang di server.
// Bukan pengaman mutlak — isi PDF tetap sampai ke browser — cuma menghentikan user biasa.

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  // Build "legacy" supaya tetap jalan di browser kantor yang agak lama. Worker dibuat sekali
  // saja per tab, di-bundle lokal (bukan CDN).
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    return pdfjs;
  });
  return pdfjsPromise;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const TEXT_LAYER_CSS = `
.edoc-pdf-page .textLayer{position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;line-height:1;letter-spacing:normal;word-spacing:normal;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:0;--min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size))}
.edoc-pdf-page .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%;user-select:text}
.edoc-pdf-page .textLayer > :not(.markedContent),.edoc-pdf-page .textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.edoc-pdf-page .textLayer .markedContent{display:contents}
.edoc-pdf-page .textLayer ::selection{background:rgba(0,0,255,.25);color:transparent}
.edoc-pdf-page .textLayer br::selection{background:transparent}
.edoc-pdf-page .textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;user-select:none}
@media print{body{display:none!important}}
`;

export function PdfViewerModal({
  fileId, title, canDownload, onClose,
}: {
  fileId: string; title: string; canDownload: boolean; onClose: () => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const [pdfjs, res] = await Promise.all([
          loadPdfJs(),
          fetch(`/api/edoc/file/${fileId}/view`, { headers: { [EDOC_VIEWER_HEADER]: "1" }, cache: "no-store" }),
        ]);
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.message || "Gagal membuka file");
        }
        const data = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        const task = pdfjs.getDocument({ data });
        loadingTask = task;
        const loaded = await task.promise;
        if (cancelled) return;
        // Zoom awal = pas lebar layar (dibatasi 0.5–1.5 supaya tidak kebesaran di monitor lebar).
        const first = await loaded.getPage(1);
        const width = (scrollRef.current?.clientWidth ?? 800) - 48;
        const fit = width / first.getViewport({ scale: 1 }).width;
        setScale(Math.min(1.5, Math.max(0.5, fit)));
        setDoc(loaded);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal membuka file");
      }
    })();
    return () => { cancelled = true; void loadingTask?.destroy(); };
  }, [fileId]);

  // Esc untuk tutup; Ctrl/Cmd+S dan Ctrl/Cmd+P diblokir selama viewer terbuka.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const zoom = (dir: 1 | -1) => setScale((s) => {
    if (s == null) return s;
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > s + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < s - 0.01);
    return next ?? s;
  });

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-slate-900/90" onContextMenu={(e) => e.preventDefault()}>
      <style>{TEXT_LAYER_CSS}</style>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white border-b border-white/10">
        <p className="text-sm font-medium truncate flex-1" title={title}>{title}</p>
        {doc && <span className="text-xs text-slate-400 shrink-0">{doc.numPages} halaman</span>}
        <button type="button" onClick={() => zoom(-1)} disabled={!doc} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40" title="Perkecil"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs w-11 text-center tabular-nums">{scale ? `${Math.round(scale * 100)}%` : "-"}</span>
        <button type="button" onClick={() => zoom(1)} disabled={!doc} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40" title="Perbesar"><ZoomIn className="w-4 h-4" /></button>
        {canDownload && (
          <a href={`/api/edoc/file/${fileId}/download`} className="ml-1 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20">
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        )}
        <button type="button" onClick={onClose} className="ml-1 p-1.5 rounded hover:bg-white/10" title="Tutup (Esc)"><X className="w-5 h-5" /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto py-6 px-6">
        {error ? (
          <p className="text-center text-sm text-red-300 mt-20">{error}</p>
        ) : !doc || scale == null ? (
          <div className="flex justify-center mt-20"><Loader2 className="w-6 h-6 text-white animate-spin" /></div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={`${i}-${scale}`} doc={doc} pageNumber={i + 1} scale={scale} root={scrollRef} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Satu halaman: ukuran kotaknya langsung dipasang (supaya scrollbar benar sejak awal), tapi
// canvas + text layer baru digambar saat halaman mendekati area terlihat — file ratusan
// halaman tetap ringan. Remount (key berubah) setiap zoom berubah.
function PdfPage({
  doc, pageNumber, scale, root,
}: {
  doc: PDFDocumentProxy; pageNumber: number; scale: number; root: React.RefObject<HTMLDivElement | null>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      setSize({ w: vp.width, h: vp.height });
    });
    return () => { cancelled = true; };
  }, [doc, pageNumber, scale]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } },
      { root: root.current, rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, visible, size]);

  useEffect(() => {
    if (!visible || !size) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let textLayer: { cancel: () => void } | null = null;
    (async () => {
      const [pdfjs, page] = await Promise.all([loadPdfJs(), doc.getPage(pageNumber)]);
      const canvas = canvasRef.current;
      const textDiv = textRef.current;
      if (cancelled || !canvas || !textDiv) return;
      const vp = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      const task = page.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      renderTask = task;
      await task.promise.catch(() => {});
      if (cancelled) return;
      textDiv.replaceChildren();
      const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport: vp });
      textLayer = tl;
      await tl.render().catch(() => {});
    })();
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [visible, size, doc, pageNumber, scale]);

  return (
    <div
      ref={boxRef}
      className="edoc-pdf-page relative bg-white shadow-lg shrink-0"
      style={{
        width: size?.w ?? 600, height: size?.h ?? 800,
        // Variabel yang dibutuhkan TextLayer pdf.js untuk menghitung posisi/ukuran teks.
        ["--total-scale-factor" as string]: scale, ["--scale-round-x" as string]: "1px", ["--scale-round-y" as string]: "1px",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div ref={textRef} className="textLayer" />
    </div>
  );
}
