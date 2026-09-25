"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FolderOpen, Folder, FileText, Plus, Upload, Download, ChevronRight, Home, Loader2,
  Archive, X, Info, Pencil, Trash2, AlertTriangle, Search, Check, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { MultiSelect, type MultiSelectOption } from "./_edoc-multiselect";

type Me = { userId: string; isSuperadmin: boolean; isFolderCreator: boolean; isDocumentApprover: boolean; businessUnits: string[] };
type FolderItem = { id: string; name: string; type: string; createdBy: string; createdAt: string; canRead: boolean; canWrite: boolean };
type FileItem = {
  id: string; title: string; description: string | null; fileUrl: string;
  requiresNumber: boolean; documentNumber: string | null; mocNumber: string | null; status: string;
  bulkImported?: boolean;
  startDate: string | null; endDate: string | null; createdAt: string; isBlasted?: boolean;
  category: { id: string; code: string; name: string } | null;
  categoryType: { id: string; code: string; name: string } | null;
};
type Reference = {
  branches: MultiSelectOption[]; positions: MultiSelectOption[];
  organizations: { id: string; name: string; code: string | null }[];
  businessUnits: { code: string; name: string }[];
  categories: { id: string; code: string; name: string; categoryTypes: { id: string; code: string; name: string }[] }[];
  branchPrefixMappings: { prefix: string; businessUnitCodes: string[] }[];
};

// Prefix branch ada di depan nama, format "PREFIX - Lokasi" (mis. "SS - JOGJA CITY MALL")
// — sama persis logic yang dipakai getUserBusinessUnits di server untuk resolve BU dari
// branchName seorang user.
function branchPrefixOf(name: string): string {
  const idx = name.indexOf(" - ");
  return idx === -1 ? name.trim() : name.slice(0, idx).trim();
}
type Breadcrumb = { id: string; name: string };
type SearchFileResult = {
  id: string; title: string; description: string | null; documentNumber: string | null; mocNumber: string | null; status: string;
  bulkImported?: boolean;
  folderId: string; folderBreadcrumb: Breadcrumb[]; createdAt: string; startDate: string | null; endDate: string | null;
  category: { id: string; code: string; name: string } | null;
  categoryType: { id: string; code: string; name: string } | null;
};
type SearchFolderResult = { id: string; name: string; type: string; breadcrumb: Breadcrumb[] };
type SearchResults = { files: SearchFileResult[]; folders: SearchFolderResult[] };

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", RELEASE: "Release" };
const STATUS_COLOR: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-600", RELEASE: "bg-emerald-50 text-emerald-700" };

export function EDocApp() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [me, setMe] = useState<Me | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  // Infinite scroll (2026-09-22) — folder hasil Bulk Import bisa berisi ratusan file,
  // sebelumnya semua dimuat sekaligus tanpa batas. `fileCursor`/`hasMoreFiles` datang dari
  // GET /api/edoc/file (cursor pagination di server); `loadingMoreFiles` beda dari
  // `loading` biasa (yang itu untuk load folder PERTAMA kali, layar penuh spinner) —
  // ini cuma spinner kecil di bawah list selagi batch berikutnya dimuat.
  const [fileCursor, setFileCursor] = useState<string | null>(null);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);
  const [totalFileCount, setTotalFileCount] = useState<number | null>(null);
  const [canWriteCurrent, setCanWriteCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadFile, setShowUploadFile] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategoryId, setSearchCategoryId] = useState("");
  const [searchCategoryTypeId, setSearchCategoryTypeId] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchBusinessUnitCode, setSearchBusinessUnitCode] = useState("");
  const [searchValidFrom, setSearchValidFrom] = useState("");
  const [searchValidTo, setSearchValidTo] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const isSearchActive = !!(searchQuery.trim() || searchCategoryId || searchCategoryTypeId || searchStatus || searchBusinessUnitCode || searchValidFrom || searchValidTo);
  const clearSearch = () => {
    setSearchQuery(""); setSearchCategoryId(""); setSearchCategoryTypeId(""); setSearchStatus(""); setSearchBusinessUnitCode("");
    setSearchValidFrom(""); setSearchValidTo(""); setSearchResults(null);
  };

  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch("/api/edoc/me").then((r) => r.json()).then(setMe).catch(() => {});
    fetch("/api/edoc/reference").then((r) => r.json()).then(setReference).catch(() => {});
  }, []);

  // Restore folder saat landing di sini dengan ?folderId=... (2026-09-22) — dipakai oleh
  // tombol "Back" di halaman detail file, supaya balik ke folder asalnya, bukan ke root
  // E Document (folder navigation di app ini murni state client, tidak pernah ke URL,
  // jadi router.back() dari detail file tanpa ini selalu mendarat di root). Sama seperti
  // openSearchFolderResult — cuma sumber breadcrumb-nya dari endpoint baru, bukan dari
  // payload search. Mount-only (baca URL sekali di awal, bukan tiap kali currentFolderId
  // berubah lewat navigasi biasa) — folder browsing selanjutnya tetap murni state seperti
  // biasa, tidak ikut menulis balik ke URL.
  useEffect(() => {
    const initialFolderId = searchParams.get("folderId");
    if (!initialFolderId) return;
    fetch(`/api/edoc/folder/${initialFolderId}/breadcrumb`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data) && j.data.length > 0) {
          setBreadcrumb(j.data);
          setCurrentFolderId(initialFolderId);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const folderQs = folderId ? `?parentFolderId=${folderId}` : "";
      const folderRes = await fetch(`/api/edoc/folder${folderQs}`);
      const folderJson = await folderRes.json();
      setFolders(folderJson.data ?? []);

      if (folderId) {
        const fileRes = await fetch(`/api/edoc/file?folderId=${folderId}`);
        const fileJson = await fileRes.json();
        setFiles(fileJson.data ?? []);
        setCanWriteCurrent(!!fileJson.canWrite);
        setHasMoreFiles(!!fileJson.hasMore);
        setFileCursor(fileJson.nextCursor ?? null);
        setTotalFileCount(typeof fileJson.totalCount === "number" ? fileJson.totalCount : null);
      } else {
        setFiles([]);
        setCanWriteCurrent(false);
        setHasMoreFiles(false);
        setFileCursor(null);
        setTotalFileCount(null);
      }
    } catch {
      showToast("error", "Gagal memuat folder");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(currentFolderId); }, [currentFolderId, load]);

  // Load batch berikutnya (infinite scroll) — APPEND ke files yang sudah ada, beda dari
  // `load()` yang mengganti seluruhnya (dipakai saat pindah folder). `loadingMoreRef`
  // (ref, dicek SINKRON di awal fungsi) mencegah 2 pemicu (mis. IntersectionObserver
  // nembak 2x berturutan) menghasilkan fetch dobel untuk batch yang sama —
  // `loadingMoreFiles` (state) murni buat UI (spinner di sentinel), tidak dipakai untuk guard.
  const loadingMoreRef = useRef(false);
  const loadMoreFiles = useCallback(async () => {
    if (!currentFolderId || !hasMoreFiles || !fileCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMoreFiles(true);
    try {
      const res = await fetch(`/api/edoc/file?folderId=${currentFolderId}&cursor=${fileCursor}`);
      const json = await res.json();
      setFiles((prev) => [...prev, ...(json.data ?? [])]);
      setHasMoreFiles(!!json.hasMore);
      setFileCursor(json.nextCursor ?? null);
    } catch {
      showToast("error", "Gagal memuat file berikutnya");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMoreFiles(false);
    }
  }, [currentFolderId, hasMoreFiles, fileCursor]);

  // Sentinel di bawah list file — begitu masuk viewport (rootMargin dikasih jarak supaya
  // load-more mulai SEBELUM benar-benar mentok bawah, bukan pas sudah kelihatan), trigger
  // loadMoreFiles(). Observer di-attach ulang tiap kali sentinel/handler berubah.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMoreFiles) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMoreFiles(); }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreFiles, loadMoreFiles]);

  // Pencarian global (file + folder, lintas seluruh tree yang bisa diakses) — debounce
  // ringan biar tidak nembak API tiap ketikan huruf. Aktif kalau ada teks ATAU minimal 1
  // filter terisi; kosongkan semuanya untuk balik ke tampilan browse folder biasa.
  useEffect(() => {
    if (!isSearchActive) { setSearchResults(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (searchCategoryId) params.set("categoryId", searchCategoryId);
        if (searchCategoryTypeId) params.set("categoryTypeId", searchCategoryTypeId);
        if (searchStatus) params.set("status", searchStatus);
        if (searchBusinessUnitCode) params.set("businessUnitCode", searchBusinessUnitCode);
        if (searchValidFrom) params.set("validFrom", searchValidFrom);
        if (searchValidTo) params.set("validTo", searchValidTo);
        const res = await fetch(`/api/edoc/search?${params.toString()}`);
        const json = await res.json();
        setSearchResults(json.data ?? { files: [], folders: [] });
      } catch {
        showToast("error", "Gagal mencari");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchCategoryId, searchCategoryTypeId, searchStatus, searchBusinessUnitCode, searchValidFrom, searchValidTo, isSearchActive]);

  const enterFolder = (f: FolderItem) => {
    setBreadcrumb((b) => [...b, { id: f.id, name: f.name }]);
    setCurrentFolderId(f.id);
  };

  // Diklik dari hasil search — langsung lompat ke lokasi folder itu (breadcrumb
  // direkonstruksi dari root, bukan cuma buka isinya tanpa konteks).
  const openSearchFolderResult = (f: SearchFolderResult) => {
    setBreadcrumb(f.breadcrumb);
    setCurrentFolderId(f.id);
    clearSearch();
  };
  const goToBreadcrumb = (index: number) => {
    if (index === -1) { setBreadcrumb([]); setCurrentFolderId(null); return; }
    const next = breadcrumb.slice(0, index + 1);
    setBreadcrumb(next);
    setCurrentFolderId(next[next.length - 1].id);
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-[90] min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header sticky (2026-09-22) — breadcrumb, tombol, search & filter selalu kelihatan
          selagi daftar file di bawahnya di-scroll, terutama untuk folder isinya banyak
          (mis. hasil Bulk Import). bg-white + z-20 supaya konten di bawahnya tidak
          "menembus" kelihatan pas nempel; top-14 = tinggi navbar (h-14) di app-shell. */}
      <div className="sticky top-14 z-20 bg-white pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1">
      {/* Business unit banner */}
      {me && me.businessUnits.length > 0 && (
        <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-sm">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-slate-600">Business unit Anda: </span>
          {me.businessUnits.map((bu) => (
            <span key={bu} className="font-mono text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{bu}</span>
          ))}
        </div>
      )}

      {/* Search & filter */}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputCls} pl-9 pr-9`}
            placeholder="Cari file (title, deskripsi, document number, MOC number) atau nama folder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearchActive && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {reference && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white"
              value={searchCategoryId}
              onChange={(e) => { setSearchCategoryId(e.target.value); setSearchCategoryTypeId(""); }}
            >
              <option value="">Semua Category</option>
              {reference.categories.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white disabled:opacity-50"
              value={searchCategoryTypeId}
              onChange={(e) => setSearchCategoryTypeId(e.target.value)}
              disabled={!searchCategoryId}
            >
              <option value="">Semua Category Type</option>
              {reference.categories.find((c) => c.id === searchCategoryId)?.categoryTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white"
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="RELEASE">Release</option>
            </select>
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white"
              value={searchBusinessUnitCode}
              onChange={(e) => setSearchBusinessUnitCode(e.target.value)}
            >
              <option value="">Semua Business Unit</option>
              {reference.businessUnits.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              Masih berlaku:
              <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white" value={searchValidFrom} onChange={(e) => setSearchValidFrom(e.target.value)} />
              s/d
              <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white" value={searchValidTo} onChange={(e) => setSearchValidTo(e.target.value)} />
            </span>
            <button
              onClick={() => router.push(`/apps/${appSlug}/edoc-items`)}
              className="flex items-center gap-1.5 text-xs border border-amber-200 bg-amber-50 text-amber-700 rounded-lg px-2 py-1.5 hover:bg-amber-100 transition-colors"
              title="Cari promo item lintas semua file IM"
            >
              <Package className="w-3.5 h-3.5" /> Item / Promo Browser
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <button onClick={() => goToBreadcrumb(-1)} className="flex items-center gap-1.5 text-slate-500 hover:text-amber-600 transition-colors shrink-0">
            <Home className="w-4 h-4" /> E Document
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <button
                onClick={() => goToBreadcrumb(i)}
                className={`truncate hover:text-amber-600 transition-colors ${i === breadcrumb.length - 1 ? "text-slate-800 font-medium" : "text-slate-500"}`}
              >
                {b.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {me?.isFolderCreator && (
            <Button onClick={() => setShowCreateFolder(true)} variant="outline" className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Folder Baru
            </Button>
          )}
          {currentFolderId && canWriteCurrent && (
            <Button onClick={() => setShowBulkUpload(true)} variant="outline" className="flex items-center gap-2">
              <Upload className="w-4 h-4" /> Bulk Upload
            </Button>
          )}
          {currentFolderId && canWriteCurrent && (
            <Button onClick={() => setShowUploadFile(true)} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload File
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Content */}
      {isSearchActive ? (
        searching ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Mencari...
          </div>
        ) : !searchResults || (searchResults.files.length === 0 && searchResults.folders.length === 0) ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">Tidak ada hasil</p>
            <p className="text-slate-400 text-sm mt-1">Coba kata kunci atau filter lain.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {searchResults.folders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Folder</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {searchResults.folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => openSearchFolderResult(f)}
                      className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all p-4 text-left"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${f.type === "OBSOLETE" ? "bg-slate-100" : "bg-amber-50"}`}>
                        {f.type === "OBSOLETE" ? <Archive className="w-5 h-5 text-slate-400" /> : <Folder className="w-5 h-5 text-amber-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                        <p className="text-xs text-slate-400 truncate">{f.breadcrumb.slice(0, -1).map((b) => b.name).join(" / ") || "Root"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchResults.files.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">File</p>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
                  {searchResults.files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => router.push(`/apps/${appSlug}/edoc-file/${file.id}`)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {file.documentNumber && (
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{file.documentNumber}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[file.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {STATUS_LABEL[file.status] ?? file.status}
                          </span>
                          {file.category && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{file.category.code}</span>}
                          {file.bulkImported && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded" title="Hasil Bulk Import — metadata mungkin belum lengkap">Bulk Import</span>}
                        </div>
                        <p className="text-sm font-medium text-slate-700 truncate">{file.title}</p>
                        <p className="text-xs text-slate-400 truncate">{file.folderBreadcrumb.map((b) => b.name).join(" / ") || "Root"}</p>
                        {(file.startDate || file.endDate) && (
                          <p className="text-xs text-slate-400">
                            Berlaku: {file.startDate ? new Date(file.startDate).toLocaleDateString("id-ID") : "-"} s/d {file.endDate ? new Date(file.endDate).toLocaleDateString("id-ID") : "-"}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">Folder ini kosong</p>
          <p className="text-slate-400 text-sm mt-1">
            {me?.isFolderCreator ? "Buat sub-folder atau upload file di sini." : "Tidak ada folder/file yang bisa Anda akses di sini."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {folders.map((f) => {
                const canEdit = !!me && (me.isSuperadmin || f.createdBy === me.userId);
                return (
                  <button
                    key={f.id}
                    onClick={() => enterFolder(f)}
                    className="relative flex items-center gap-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all p-4 text-left group"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${f.type === "OBSOLETE" ? "bg-slate-100" : "bg-amber-50 group-hover:bg-amber-100"} transition-colors`}>
                      {f.type === "OBSOLETE"
                        ? <Archive className="w-5 h-5 text-slate-400" />
                        : <Folder className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                      {f.type === "OBSOLETE" && <p className="text-xs text-slate-400">Obsolete</p>}
                    </div>
                    {canEdit && (
                      <span className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setEditingFolder(f); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setEditingFolder(f); } }}
                          title="Edit folder"
                          className="p-1.5 rounded-lg text-slate-300 hover:text-amber-600 hover:bg-amber-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setDeletingFolder(f); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setDeletingFolder(f); } }}
                          title="Hapus folder"
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {files.length > 0 && (
            <div>
              {/* Total file di folder ini (2026-09-22) — dihitung server-side terpisah dari
                  daftar yang dipaginate, jadi tetap akurat meski baru sebagian ter-load. */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {totalFileCount !== null ? `${totalFileCount} File` : "File"}
              </p>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => router.push(`/apps/${appSlug}/edoc-file/${file.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {file.documentNumber && (
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{file.documentNumber}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[file.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABEL[file.status] ?? file.status}
                      </span>
                      {file.category && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{file.category.code}</span>}
                      {file.isBlasted && <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded" title="File aslinya ada di folder lain, cuma ditampilkan juga di sini (Blast)">Blast</span>}
                      {file.bulkImported && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded" title="Hasil Bulk Import — metadata mungkin belum lengkap">Bulk Import</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate">{file.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 shrink-0 transition-colors" />
                </button>
              ))}
              {/* Sentinel infinite scroll — begitu masuk viewport, batch berikutnya
                  dimuat otomatis (lihat loadMoreFiles/IntersectionObserver di atas).
                  Spinner cuma tampil selagi benar-benar fetching (loadingMoreFiles) —
                  sebelum itu sentinel-nya tetap ada (perlu diobservasi) tapi kosong. */}
              {hasMoreFiles && (
                <div ref={sentinelRef} className="flex items-center justify-center py-4 text-slate-400 text-sm gap-2 h-10">
                  {loadingMoreFiles && <><Loader2 className="w-4 h-4 animate-spin" /> Memuat file berikutnya...</>}
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateFolder && reference && (
        <CreateFolderModal
          parentFolderId={currentFolderId}
          reference={reference}
          onClose={() => setShowCreateFolder(false)}
          onCreated={() => { setShowCreateFolder(false); void load(currentFolderId); showToast("success", "Folder berhasil dibuat"); }}
          onError={(m) => showToast("error", m)}
        />
      )}

      {showUploadFile && reference && currentFolderId && (
        <UploadFileModal
          folderId={currentFolderId}
          reference={reference}
          onClose={() => setShowUploadFile(false)}
          onCreated={() => { setShowUploadFile(false); void load(currentFolderId); showToast("success", "File berhasil diupload"); }}
          onError={(m) => showToast("error", m)}
        />
      )}

      {showBulkUpload && reference && currentFolderId && (
        <BulkUploadModal
          folderId={currentFolderId}
          reference={reference}
          onClose={() => setShowBulkUpload(false)}
          onDone={(succeeded) => { setShowBulkUpload(false); void load(currentFolderId); showToast("success", `${succeeded} file berhasil di-bulk-upload`); }}
          onError={(m) => showToast("error", m)}
        />
      )}

      {editingFolder && reference && (
        <EditFolderModal
          folder={editingFolder}
          reference={reference}
          onClose={() => setEditingFolder(null)}
          onSaved={() => { setEditingFolder(null); void load(currentFolderId); showToast("success", "Folder berhasil diperbarui"); }}
          onError={(m) => showToast("error", m)}
        />
      )}

      {deletingFolder && (
        <DeleteFolderModal
          folder={deletingFolder}
          onClose={() => setDeletingFolder(null)}
          onDeleted={() => { setDeletingFolder(null); void load(currentFolderId); showToast("success", "Folder berhasil dihapus"); }}
          onError={(m) => showToast("error", m)}
        />
      )}
    </div>
  );
}

// ===================== Create Folder Modal =====================

function CreateFolderModal({
  parentFolderId, reference, onClose, onCreated, onError,
}: {
  parentFolderId: string | null; reference: Reference;
  onClose: () => void; onCreated: () => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"NORMAL" | "OBSOLETE">("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [acl, setAcl] = useState({
    readBranchIds: [] as string[], readOrgIds: [] as string[], readPositionIds: [] as string[], readBusinessUnitCodes: [] as string[],
    writeBranchIds: [] as string[], writeOrgIds: [] as string[], writePositionIds: [] as string[], writeBusinessUnitCodes: [] as string[],
  });

  const orgOptions: MultiSelectOption[] = reference.organizations.map((o) => ({ id: o.id, name: o.code ? `${o.code} — ${o.name}` : o.name }));
  const buOptions: MultiSelectOption[] = reference.businessUnits.map((b) => ({ id: b.code, name: b.name }));

  const submit = async () => {
    if (!name.trim()) { onError("Nama folder wajib diisi"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/edoc/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentFolderId, type, ...acl }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal membuat folder"); return; }
      onCreated();
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open title="Buat Folder Baru" onClose={onClose} boxClassName="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Nama Folder <span className="text-red-500">*</span></label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: SOP Marketing 2026" />
        </div>

        <div>
          <label className={labelCls}>Tipe</label>
          <div className="flex gap-2">
            {(["NORMAL", "OBSOLETE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${type === t ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
              >
                {t === "NORMAL" ? "Normal" : "Obsolete"}
              </button>
            ))}
          </div>
          {type === "OBSOLETE" && (
            <p className="text-xs text-slate-400 mt-1.5">Folder Obsolete hanya bisa dibrowse isinya oleh Anda (pembuat) dan superadmin, terlepas dari ACL di bawah.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Read Access</p>
            <MultiSelect label="Branch" options={reference.branches} selected={acl.readBranchIds} onChange={(v) => setAcl((a) => ({ ...a, readBranchIds: v }))} />
            <MultiSelect label="Organisasi" options={orgOptions} selected={acl.readOrgIds} onChange={(v) => setAcl((a) => ({ ...a, readOrgIds: v }))} />
            <MultiSelect label="Jabatan" options={reference.positions} selected={acl.readPositionIds} onChange={(v) => setAcl((a) => ({ ...a, readPositionIds: v }))} />
            <MultiSelect label="Business Unit" options={buOptions} selected={acl.readBusinessUnitCodes} onChange={(v) => setAcl((a) => ({ ...a, readBusinessUnitCodes: v }))} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Write Access <span className="normal-case font-normal text-slate-400">(otomatis dapat read)</span></p>
            <MultiSelect label="Branch" options={reference.branches} selected={acl.writeBranchIds} onChange={(v) => setAcl((a) => ({ ...a, writeBranchIds: v }))} />
            <MultiSelect label="Organisasi" options={orgOptions} selected={acl.writeOrgIds} onChange={(v) => setAcl((a) => ({ ...a, writeOrgIds: v }))} />
            <MultiSelect label="Jabatan" options={reference.positions} selected={acl.writePositionIds} onChange={(v) => setAcl((a) => ({ ...a, writePositionIds: v }))} />
            <MultiSelect label="Business Unit" options={buOptions} selected={acl.writeBusinessUnitCodes} onChange={(v) => setAcl((a) => ({ ...a, writeBusinessUnitCodes: v }))} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={submit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Menyimpan..." : "Buat Folder"}
          </Button>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== Edit Folder Modal =====================

type FolderDetail = {
  name: string; type: string;
  readBranchIds: string[]; readOrgIds: string[]; readPositionIds: string[]; readBusinessUnitCodes: string[];
  writeBranchIds: string[]; writeOrgIds: string[]; writePositionIds: string[]; writeBusinessUnitCodes: string[];
};

function EditFolderModal({
  folder, reference, onClose, onSaved, onError,
}: {
  folder: FolderItem; reference: Reference;
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"NORMAL" | "OBSOLETE">("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [acl, setAcl] = useState({
    readBranchIds: [] as string[], readOrgIds: [] as string[], readPositionIds: [] as string[], readBusinessUnitCodes: [] as string[],
    writeBranchIds: [] as string[], writeOrgIds: [] as string[], writePositionIds: [] as string[], writeBusinessUnitCodes: [] as string[],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/edoc/folder/${folder.id}`);
        const json = await res.json();
        if (!res.ok) { onError(json.message || "Gagal memuat detail folder"); onClose(); return; }
        const d: FolderDetail = json.data;
        setName(d.name);
        setType(d.type === "OBSOLETE" ? "OBSOLETE" : "NORMAL");
        setAcl({
          readBranchIds: d.readBranchIds, readOrgIds: d.readOrgIds, readPositionIds: d.readPositionIds, readBusinessUnitCodes: d.readBusinessUnitCodes,
          writeBranchIds: d.writeBranchIds, writeOrgIds: d.writeOrgIds, writePositionIds: d.writePositionIds, writeBusinessUnitCodes: d.writeBusinessUnitCodes,
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.id]);

  const orgOptions: MultiSelectOption[] = reference.organizations.map((o) => ({ id: o.id, name: o.code ? `${o.code} — ${o.name}` : o.name }));
  const buOptions: MultiSelectOption[] = reference.businessUnits.map((b) => ({ id: b.code, name: b.name }));

  const submit = async () => {
    if (!name.trim()) { onError("Nama folder wajib diisi"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/edoc/folder/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, ...acl }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menyimpan folder"); return; }
      onSaved();
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open title="Edit Folder" onClose={onClose} boxClassName="max-w-2xl">
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nama Folder <span className="text-red-500">*</span></label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: SOP Marketing 2026" />
            <p className="text-xs text-slate-400 mt-1.5">Ganti nama di sini juga akan mengganti nama folder fisiknya di Nextcloud (isinya ikut pindah otomatis).</p>
          </div>

          <div>
            <label className={labelCls}>Tipe</label>
            <div className="flex gap-2">
              {(["NORMAL", "OBSOLETE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${type === t ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  {t === "NORMAL" ? "Normal" : "Obsolete"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Read Access</p>
              <MultiSelect label="Branch" options={reference.branches} selected={acl.readBranchIds} onChange={(v) => setAcl((a) => ({ ...a, readBranchIds: v }))} />
              <MultiSelect label="Organisasi" options={orgOptions} selected={acl.readOrgIds} onChange={(v) => setAcl((a) => ({ ...a, readOrgIds: v }))} />
              <MultiSelect label="Jabatan" options={reference.positions} selected={acl.readPositionIds} onChange={(v) => setAcl((a) => ({ ...a, readPositionIds: v }))} />
              <MultiSelect label="Business Unit" options={buOptions} selected={acl.readBusinessUnitCodes} onChange={(v) => setAcl((a) => ({ ...a, readBusinessUnitCodes: v }))} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Write Access <span className="normal-case font-normal text-slate-400">(otomatis dapat read)</span></p>
              <MultiSelect label="Branch" options={reference.branches} selected={acl.writeBranchIds} onChange={(v) => setAcl((a) => ({ ...a, writeBranchIds: v }))} />
              <MultiSelect label="Organisasi" options={orgOptions} selected={acl.writeOrgIds} onChange={(v) => setAcl((a) => ({ ...a, writeOrgIds: v }))} />
              <MultiSelect label="Jabatan" options={reference.positions} selected={acl.writePositionIds} onChange={(v) => setAcl((a) => ({ ...a, writePositionIds: v }))} />
              <MultiSelect label="Business Unit" options={buOptions} selected={acl.writeBusinessUnitCodes} onChange={(v) => setAcl((a) => ({ ...a, writeBusinessUnitCodes: v }))} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={submit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button variant="outline" onClick={onClose}>Batal</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ===================== Delete Folder Modal =====================

// Attempts the delete immediately on open (no confirm body) — if the folder turns out to
// be empty, the server deletes it right away and this closes without ever showing the
// warning UI. If it's non-empty, the server refuses (409 + counts) instead of deleting,
// and this then shows the counts + requires typing "DELETE" before resubmitting with
// `{ confirm: "DELETE" }` to actually go through with the recursive delete.
// Konfirmasi SELALU ditampilkan, termasuk untuk folder kosong (dipertegas 2026-09-15) —
// cuma bedanya folder kosong tidak perlu ketik "DELETE", tinggal klik Hapus.
function DeleteFolderModal({
  folder, onClose, onDeleted, onError,
}: {
  folder: FolderItem; onClose: () => void; onDeleted: () => void; onError: (m: string) => void;
}) {
  const [checking, setChecking] = useState(true);
  const [counts, setCounts] = useState<{ folderCount: number; fileCount: number } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Panggilan tanpa confirm ini TIDAK PERNAH benar-benar menghapus (backend selalu
        // membalas 409 kalau confirm belum dikirim) — cuma dipakai untuk mengambil
        // folderCount/fileCount sebelum menampilkan dialog konfirmasi yang sesuai.
        const res = await fetch(`/api/edoc/folder/${folder.id}`, { method: "DELETE" });
        const json = await res.json().catch(() => ({}));
        if (res.status === 409 && json.requiresConfirm) {
          setCounts({ folderCount: json.folderCount ?? 0, fileCount: json.fileCount ?? 0 });
          setChecking(false);
          return;
        }
        onError(json.message || "Gagal memeriksa folder");
        onClose();
      } catch {
        onError("Gagal memeriksa folder");
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.id]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/edoc/folder/${folder.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { onError(json.message || "Gagal menghapus folder"); return; }
      onDeleted();
    } finally { setDeleting(false); }
  };

  if (checking) {
    return (
      <Modal open title="Hapus Folder" onClose={onClose}>
        <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      </Modal>
    );
  }
  if (!counts) return null;

  const isEmpty = counts.folderCount === 0 && counts.fileCount === 0;

  return (
    <Modal open title="Hapus Folder" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            {isEmpty ? (
              <p>Folder &ldquo;{folder.name}&rdquo; kosong dan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.</p>
            ) : (
              <>
                <p className="font-medium">Folder &ldquo;{folder.name}&rdquo; masih berisi:</p>
                <ul className="list-disc list-inside mt-1">
                  {counts.folderCount > 0 && <li>{counts.folderCount} sub-folder</li>}
                  {counts.fileCount > 0 && <li>{counts.fileCount} file</li>}
                </ul>
                <p className="mt-2">Semua isi di atas akan ikut terhapus permanen (termasuk file fisiknya di storage). Tindakan ini tidak bisa dibatalkan.</p>
              </>
            )}
          </div>
        </div>
        {!isEmpty && (
          <div>
            <label className={labelCls}>Ketik <span className="font-mono font-semibold">DELETE</span> untuk konfirmasi</label>
            <input className={inputCls} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={confirmDelete} disabled={(!isEmpty && confirmText !== "DELETE") || deleting} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {deleting ? "Menghapus..." : isEmpty ? "Hapus Folder" : "Hapus Semua"}
          </Button>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== Blast Folder Picker =====================

// `path` = breadcrumb lengkap ("Root / Sub / ...") — dipakai sebagai label folder yang
// SUDAH dipilih, karena nama folder bisa sama di lokasi berbeda (nama saja bisa bikin
// bingung folder mana yang sebenarnya kepilih).
export type BlastFolderOption = { id: string; name: string; path: string };
type BlastSearchResult = { id: string; name: string; breadcrumb: Breadcrumb[] };

// Folder MANAPUN bisa jadi tujuan Blast (bebas, tidak dicek akses — keputusan eksplisit
// user) — file yang sama ikut muncul di folder-folder ini juga (link, bukan disalin
// fisik). Picker-nya browsing folder-demi-folder ala halaman utama E Doc (breadcrumb +
// tile, klik masuk ke child), plus kotak cari cepat untuk lompat langsung by nama. Bisa
// pilih beberapa folder sekaligus (modal tetap terbuka setelah "Pilih folder ini").
export function BlastFolderPicker({ selected, onChange }: { selected: BlastFolderOption[]; onChange: (v: BlastFolderOption[]) => void }) {
  const [open, setOpen] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<Breadcrumb[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [children, setChildren] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BlastSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/edoc/folder/search?parentFolderId=${currentFolderId ?? "root"}`)
      .then((r) => r.json())
      .then((j) => setChildren(j.data ?? []))
      .finally(() => setLoading(false));
  }, [open, currentFolderId]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/edoc/folder/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        setSearchResults(json.data ?? []);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const enterFolder = (f: Breadcrumb) => { setBreadcrumb((b) => [...b, f]); setCurrentFolderId(f.id); };
  const goToBreadcrumb = (index: number) => {
    if (index === -1) { setBreadcrumb([]); setCurrentFolderId(null); return; }
    const next = breadcrumb.slice(0, index + 1);
    setBreadcrumb(next);
    setCurrentFolderId(next[next.length - 1].id);
  };
  const jumpToSearchResult = (f: BlastSearchResult) => {
    setBreadcrumb(f.breadcrumb);
    setCurrentFolderId(f.id);
    setQuery(""); setSearchResults([]);
  };

  const add = (f: BlastFolderOption) => { if (!selected.some((s) => s.id === f.id)) onChange([...selected, f]); };
  const remove = (id: string) => onChange(selected.filter((s) => s.id !== id));

  const currentIsSelected = currentFolderId != null && selected.some((s) => s.id === currentFolderId);

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <FolderOpen className="w-3.5 h-3.5" /> Pilih Folder Tujuan Blast
      </Button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((f) => (
            <span key={f.id} title={f.path} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {f.path || f.name}
              <button type="button" onClick={() => remove(f.id)} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}

      <Modal open={open} title="Pilih Folder Tujuan Blast" onClose={() => setOpen(false)} boxClassName="max-w-xl">
        <div className="space-y-3">
          <div className="relative">
            <input className={inputCls} placeholder="Cari nama folder untuk lompat langsung..." value={query} onChange={(e) => setQuery(e.target.value)} />
            {query.trim() && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-slate-400">Mencari...</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</p>
                ) : (
                  searchResults.map((f) => (
                    <button key={f.id} type="button" onClick={() => jumpToSearchResult(f)} className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors">
                      <p className="text-sm text-slate-700">{f.name}</p>
                      <p className="text-xs text-slate-400 truncate">{f.breadcrumb.slice(0, -1).map((b) => b.name).join(" / ") || "Root"}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm flex-wrap border-b border-slate-100 pb-2">
            <button onClick={() => goToBreadcrumb(-1)} className="flex items-center gap-1 text-slate-500 hover:text-amber-600 transition-colors shrink-0">
              <Home className="w-3.5 h-3.5" /> E Document
            </button>
            {breadcrumb.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <button onClick={() => goToBreadcrumb(i)} className={`truncate hover:text-amber-600 transition-colors ${i === breadcrumb.length - 1 ? "text-slate-800 font-medium" : "text-slate-500"}`}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{currentFolderId ? "Folder saat ini bisa dipilih, atau klik salah satu di bawah untuk masuk lebih dalam." : "Pilih folder di bawah untuk mulai menelusuri."}</p>
            {currentFolderId && (
              <Button
                type="button" size="sm" disabled={currentIsSelected}
                onClick={() => add({ id: currentFolderId, name: breadcrumb[breadcrumb.length - 1]?.name ?? "", path: breadcrumb.map((b) => b.name).join(" / ") })}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                {currentIsSelected ? "Sudah dipilih" : "+ Pilih folder ini"}
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : children.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Tidak ada sub-folder di sini.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {children.map((f) => (
                <button key={f.id} type="button" onClick={() => enterFolder(f)} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-left hover:border-amber-300 hover:bg-amber-50/50 transition-colors">
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                  {selected.some((s) => s.id === f.id) && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setOpen(false)}>Selesai</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===================== Upload File Modal =====================

function UploadFileModal({
  folderId, reference, onClose, onCreated, onError,
}: {
  folderId: string; reference: Reference;
  onClose: () => void; onCreated: () => void; onError: (m: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryTypeId, setCategoryTypeId] = useState("");
  const [businessUnitCodes, setBusinessUnitCodes] = useState<string[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [blastEnabled, setBlastEnabled] = useState(false);
  const [blastFolders, setBlastFolders] = useState<BlastFolderOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [obsoleteDestinationFolderId, setObsoleteDestinationFolderId] = useState("");
  const [obsoleteFolders, setObsoleteFolders] = useState<{ id: string; name: string }[]>([]);
  const [requiresItemImport, setRequiresItemImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [productExcel, setProductExcel] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const productExcelRef = useRef<HTMLInputElement>(null);

  const downloadProductTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch("/api/edoc/im-product/template");
      if (!res.ok) { onError("Gagal download template"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template Promo per Item.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloadingTemplate(false); }
  };

  const selectedCategory = reference.categories.find((c) => c.id === categoryId);

  // Business Unit <-> Branch: pilih BU -> branch yang prefix-nya terkait ikut auto-checklist.
  // Lepas centang BU -> branch yang HANYA terkait BU itu ikut auto-uncheck juga — TAPI kalau
  // prefix-nya masih terkait ke BU lain yang masih dipilih (mis. prefix "SS" dipakai
  // SKIN+ & SLIM+ sekaligus), branch itu tetap dibiarkan checklist. Trade-off yang disadari:
  // branch yang kebetulan dicentang manual dengan prefix yang sama bisa ikut ke-uncheck —
  // diterima karena user secara eksplisit minta perilaku auto-uncheck ini.
  const handleBusinessUnitCodesChange = (newCodes: string[]) => {
    const addedCodes = newCodes.filter((c) => !businessUnitCodes.includes(c));
    const removedCodes = businessUnitCodes.filter((c) => !newCodes.includes(c));
    setBusinessUnitCodes(newCodes);
    if (addedCodes.length === 0 && removedCodes.length === 0) return;

    const prefixesFor = (codes: string[]) =>
      reference.branchPrefixMappings.filter((m) => m.businessUnitCodes.some((c) => codes.includes(c))).map((m) => m.prefix);
    const branchIdsForPrefixes = (prefixes: string[]) =>
      reference.branches.filter((b) => prefixes.includes(branchPrefixOf(b.name))).map((b) => b.id);

    const stillRelevantPrefixes = new Set(prefixesFor(newCodes));

    setBranchIds((prev) => {
      let next = prev;
      if (addedCodes.length > 0) {
        const toAdd = branchIdsForPrefixes(prefixesFor(addedCodes));
        next = Array.from(new Set([...next, ...toAdd]));
      }
      if (removedCodes.length > 0) {
        const removedPrefixes = prefixesFor(removedCodes).filter((p) => !stillRelevantPrefixes.has(p));
        const toRemove = new Set(branchIdsForPrefixes(removedPrefixes));
        next = next.filter((id) => !toRemove.has(id));
      }
      return next;
    });
  };

  // Diambil terpisah dari daftar folder biasa — folder Obsolete disembunyikan dari
  // listing/search untuk siapapun selain pembuat/superadmin, tapi memilihnya sebagai
  // tujuan arsip otomatis tetap harus bisa dilakukan siapa saja yang boleh upload di sini.
  useEffect(() => {
    fetch(`/api/edoc/folder/obsolete-destinations?parentFolderId=${folderId}`)
      .then((r) => r.json())
      .then((j) => setObsoleteFolders(j.data ?? []))
      .catch(() => {});
  }, [folderId]);

  const submit = async () => {
    if (!title.trim()) { onError("Title wajib diisi"); return; }
    if (!categoryId) { onError("Category wajib dipilih"); return; }
    if (!file) { onError("File PDF wajib diupload"); return; }
    if (endDate && !obsoleteDestinationFolderId) { onError("Pilih folder tujuan Obsolete jika mengisi end date"); return; }
    if (requiresItemImport && !productExcel) { onError("File ini promo — Excel produk/item wajib diupload sekarang"); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("folderId", folderId);
      fd.append("title", title.trim());
      if (description.trim()) fd.append("description", description.trim());
      fd.append("categoryId", categoryId);
      if (categoryTypeId) fd.append("categoryTypeId", categoryTypeId);
      businessUnitCodes.forEach((code) => fd.append("businessUnitCodes", code));
      branchIds.forEach((id) => fd.append("branchIds", id));
      if (blastEnabled) blastFolders.forEach((f) => fd.append("blastFolderIds", f.id));
      if (organizationId) fd.append("organizationId", organizationId);
      if (startDate) fd.append("startDate", startDate);
      if (endDate) fd.append("endDate", endDate);
      if (obsoleteDestinationFolderId) fd.append("obsoleteDestinationFolderId", obsoleteDestinationFolderId);
      fd.append("requiresItemImport", String(requiresItemImport));
      if (requiresItemImport && productExcel) fd.append("productExcel", productExcel);
      fd.append("file", file);

      const res = await fetch("/api/edoc/file", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal upload file"); return; }
      onCreated();
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open title="Upload File" onClose={onClose} boxClassName="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>File PDF <span className="text-red-500">*</span></label>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <FileText className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-800 truncate flex-1">{file.name}</p>
              <button type="button" onClick={() => setFile(null)} className="p-1 text-green-600 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
              <Upload className="w-4 h-4" /> Klik untuk pilih file PDF
            </button>
          )}
        </div>

        <div>
          <label className={labelCls}>Title <span className="text-red-500">*</span></label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category <span className="text-red-500">*</span></label>
            <select className={inputCls} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setCategoryTypeId(""); }}>
              <option value="">Pilih category...</option>
              {reference.categories.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Category Type</label>
            <select className={inputCls} value={categoryTypeId} onChange={(e) => setCategoryTypeId(e.target.value)} disabled={!selectedCategory?.categoryTypes.length}>
              <option value="">-</option>
              {selectedCategory?.categoryTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MultiSelect
            label="Business Unit" options={reference.businessUnits.map((b) => ({ id: b.code, name: b.name }))}
            selected={businessUnitCodes} onChange={handleBusinessUnitCodesChange}
          />
          <MultiSelect label="Branch" options={reference.branches} selected={branchIds} onChange={setBranchIds} />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox" checked={blastEnabled}
              onChange={(e) => { setBlastEnabled(e.target.checked); if (!e.target.checked) setBlastFolders([]); }}
              className="rounded border-slate-300"
            />
            Blast — tampilkan file ini juga di folder lain
          </label>
          {blastEnabled && (
            <div className="mt-2 pl-6">
              <BlastFolderPicker selected={blastFolders} onChange={setBlastFolders} />
              <p className="text-xs text-slate-400 mt-1">
                File tetap 1 (bukan disalin) — cuma ikut muncul di folder yang dipilih. Kalau file ini expired/Obsolete/dihapus, kemunculannya di semua folder ikut hilang.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Organisasi/Departemen</label>
          <select className={inputCls} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            <option value="">-</option>
            {reference.organizations.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Begitu lewat tanggal ini, file otomatis dipindah ke folder Obsolete di bawah.</p>
          </div>
        </div>

        {endDate && (
          <div>
            <label className={labelCls}>Folder Tujuan Obsolete <span className="text-red-500">*</span></label>
            <select className={inputCls} value={obsoleteDestinationFolderId} onChange={(e) => setObsoleteDestinationFolderId(e.target.value)}>
              <option value="">-</option>
              {obsoleteFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {obsoleteFolders.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Tidak ada folder Obsolete di sini — buat dulu jika ingin set end date.</p>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400 -mt-1">
          File ini akan masuk antrian Approval Document (Document Number wajib untuk semua file).
        </p>

        {selectedCategory?.code === "IM" && (
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox" checked={requiresItemImport}
                onChange={(e) => { setRequiresItemImport(e.target.checked); if (!e.target.checked) setProductExcel(null); }}
                className="rounded border-slate-300"
              />
              File ini promo (butuh lampiran item)
            </label>
            {requiresItemImport && (
              <div className="mt-2 pl-6">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Excel Produk/Item <span className="text-red-500">*</span></label>
                  <button type="button" disabled={downloadingTemplate} onClick={downloadProductTemplate} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 disabled:opacity-50">
                    {downloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download Template
                  </button>
                </div>
                <input
                  ref={productExcelRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => setProductExcel(e.target.files?.[0] ?? null)}
                />
                {productExcel ? (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm font-medium text-green-800 truncate flex-1">{productExcel.name}</p>
                    <button type="button" onClick={() => setProductExcel(null)} className="p-1 text-green-600 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => productExcelRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-colors text-sm">
                    <Upload className="w-4 h-4" /> Klik untuk pilih Excel produk/item (sheet &ldquo;Promo per Item&rdquo;)
                  </button>
                )}
                <p className="text-xs text-slate-400 mt-1">Wajib diisi sekarang — file promo tidak bisa diupload tanpa minimal 1 item.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={submit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Mengupload..." : "Upload"}
          </Button>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== Bulk Upload Modal =====================
// Migrasi awal (2026-09-21) — dump banyak PDF ke 1 folder, BYPASS approval total (langsung
// RELEASE, requiresNumber=false, tanpa Document Number). Sengaja minim field — cuma folder
// tujuan (sudah ditentukan dari halaman ini) + 1 Category yang berlaku untuk SEMUA file +
// daftar PDF. Title otomatis dari nama file. Field lain (BU, Branch, tanggal, Nomor Dokumen
// manual, dst) dilengkapi belakangan lewat tombol "Edit" di halaman detail tiap file —
// lihat canEditFileMetadata di app/lib/edoc.ts.
//
// Upload 1 REQUEST PER FILE (diubah 2026-09-22 — sebelumnya semua file dibungkus jadi 1
// request `fetch()` raksasa: tidak ada progress granular per file, dan 1 koneksi putus
// menggagalkan SELURUH batch sekaligus). Sekarang tiap file dikirim lewat XHR terpisah
// (perlu XHR, bukan fetch, supaya dapat event `progress` asli), SEKUENSIAL satu per satu
// (dipilih user — lebih lambat tapi paling aman untuk server/Nextcloud) — 1 file gagal
// cuma menggagalkan file itu, sisanya tetap lanjut, dan retry cukup untuk yang gagal saja.
//
// idempotencyKey: 1 key acak DIBUAT SEKALI per item saat masuk antrian, dikirim apa
// adanya di setiap percobaan TERMASUK retry (bukan digenerate ulang) — kalau server
// sempat sukses tapi response-nya tidak sampai (koneksi putus di detik terakhir), retry
// dengan key yang sama membuat server mengembalikan file yang SUDAH ADA, bukan bikin baru
// (lihat POST /api/edoc/file/bulk) — jadi retry benar-benar tidak pernah menghasilkan dobel.
//
// xhr.timeout 5 menit — jaga-jaga kalau koneksi menggantung total (bukan putus, TIDAK ada
// event error/progress lanjutan sama sekali) supaya antrian sekuensial tidak macet
// selamanya di 1 file. 5 menit dipilih longgar (file di sini realistis puluhan MB, bukan
// ratusan) — kalau upload masih maju (progress event masih jalan) ini praktis tidak
// pernah kepicu; cuma jaring pengaman untuk koneksi yang benar-benar mati rasa.
type QueueStatus = "queued" | "uploading" | "success" | "error";
type QueueItem = { file: File; idempotencyKey: string; status: QueueStatus; progress: number; error?: string };
const queueKey = (f: File) => `${f.name}-${f.size}`;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function uploadOneFile(
  file: File, folderId: string, categoryId: string, idempotencyKey: string, onProgress: (pct: number) => void
): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/edoc/file/bulk");
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let json: { message?: string } = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* respons bukan JSON, message tetap kosong */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else resolve({ ok: false, message: json.message || `Gagal upload (HTTP ${xhr.status})` });
    };
    xhr.onerror = () => resolve({ ok: false, message: "Koneksi terputus" });
    xhr.ontimeout = () => resolve({ ok: false, message: "Upload timeout — koneksi menggantung terlalu lama" });

    const fd = new FormData();
    fd.append("folderId", folderId);
    fd.append("categoryId", categoryId);
    fd.append("idempotencyKey", idempotencyKey);
    fd.append("file", file);
    xhr.send(fd);
  });
}

function BulkUploadModal({
  folderId, reference, onClose, onDone, onError,
}: {
  folderId: string; reference: Reference;
  onClose: () => void; onDone: (succeeded: number) => void; onError: (m: string) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const unmountedRef = useRef(false);
  useEffect(() => () => { unmountedRef.current = true; }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    setQueue((prev) => [
      ...prev,
      ...picked
        .filter((f) => !prev.some((p) => queueKey(p.file) === queueKey(f)))
        .map((file) => ({ file, idempotencyKey: crypto.randomUUID(), status: "queued" as const, progress: 0 })),
    ]);
  };
  const removeFile = (key: string) => setQueue((prev) => prev.filter((q) => queueKey(q.file) !== key));

  const updateItem = (key: string, patch: Partial<QueueItem>) => {
    if (unmountedRef.current) return;
    setQueue((prev) => prev.map((q) => (queueKey(q.file) === key ? { ...q, ...patch } : q)));
  };

  // Sekuensial — jalankan satu per satu, tunggu file sebelumnya benar-benar selesai
  // (sukses/gagal) sebelum lanjut ke berikutnya. Return jumlah yang sukses di run ini.
  const runQueue = async (items: QueueItem[]): Promise<number> => {
    setRunning(true); setStarted(true);
    let successCount = 0;
    for (const item of items) {
      const key = queueKey(item.file);
      updateItem(key, { status: "uploading", progress: 0, error: undefined });
      const result = await uploadOneFile(item.file, folderId, categoryId, item.idempotencyKey, (pct) => updateItem(key, { progress: pct }));
      if (result.ok) { updateItem(key, { status: "success", progress: 100 }); successCount++; }
      else updateItem(key, { status: "error", error: result.message });
    }
    if (!unmountedRef.current) setRunning(false);
    return successCount;
  };

  const start = async () => {
    if (!categoryId) { onError("Category wajib dipilih"); return; }
    if (queue.length === 0) { onError("Pilih minimal 1 file PDF"); return; }
    const successCount = await runQueue(queue);
    // Semua sukses di percobaan pertama — langsung tutup & refresh, tidak perlu ganggu
    // user lihat ringkasan. Kalau ada yang gagal, modal tetap terbuka (lihat render di
    // bawah) supaya user bisa retry yang gagal saja, baru klik Selesai manual.
    if (successCount === queue.length) onDone(successCount);
  };

  const retryFailed = () => { void runQueue(queue.filter((q) => q.status === "error")); };

  const succeededCount = queue.filter((q) => q.status === "success").length;
  const failedCount = queue.filter((q) => q.status === "error").length;
  const doneRunning = started && !running;

  return (
    <Modal open title="Bulk Upload (Migrasi Awal)" onClose={running ? () => {} : onClose} boxClassName="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Khusus migrasi dokumen lama — file langsung berstatus <b>Release</b> tanpa antrian approval dan tanpa Document Number.
          Title otomatis dari nama file. Lengkapi tanggal/BU/Branch/Nomor Dokumen belakangan lewat tombol Edit di halaman detail tiap file.
        </p>

        <div>
          <label className={labelCls}>Category <span className="text-red-500">*</span></label>
          <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={started}>
            <option value="">Pilih category...</option>
            {reference.categories.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-1">Berlaku untuk semua file dalam batch ini — kalau ada category lain, upload di batch terpisah.</p>
        </div>

        <div>
          <label className={labelCls}>File PDF <span className="text-red-500">*</span></label>
          {!started && (
            <>
              <input ref={filesRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => filesRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
                <Upload className="w-4 h-4" /> Klik untuk pilih banyak file PDF sekaligus
              </button>
            </>
          )}
          {queue.length > 0 && (
            <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
              {queue.map((q) => {
                const key = queueKey(q.file);
                return (
                  <div key={key} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      {q.status === "success" ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        : q.status === "error" ? <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        : q.status === "uploading" ? <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                        : <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <p className="text-xs text-slate-700 truncate flex-1">{q.file.name}</p>
                      {q.status === "uploading" && <span className="text-xs font-medium text-amber-600 shrink-0">{q.progress}%</span>}
                      {!started && (
                        <button type="button" onClick={() => removeFile(key)} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    {q.status === "uploading" && (
                      <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all" style={{ width: `${q.progress}%` }} />
                      </div>
                    )}
                    {q.status === "error" && <p className="text-xs text-red-500 mt-1">{q.error}</p>}
                  </div>
                );
              })}
              <p className="text-xs text-slate-400 pt-1">
                {started ? `${succeededCount} sukses, ${failedCount} gagal dari ${queue.length} file` : `${queue.length} file dipilih`}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          {!started ? (
            <>
              <Button onClick={start} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
                {`Upload ${queue.length || ""} File`}
              </Button>
              <Button variant="outline" onClick={onClose}>Batal</Button>
            </>
          ) : running ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Mengupload...</p>
          ) : doneRunning && failedCount > 0 ? (
            <>
              <Button onClick={retryFailed} variant="outline" className="flex items-center gap-2">Retry Gagal ({failedCount})</Button>
              <Button onClick={() => onDone(succeededCount)} className="bg-amber-600 hover:bg-amber-700 text-white">Selesai</Button>
            </>
          ) : (
            <Button onClick={() => onDone(succeededCount)} className="bg-amber-600 hover:bg-amber-700 text-white">Selesai</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
