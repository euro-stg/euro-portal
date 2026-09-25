"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, Download, Upload, Loader2, CheckCircle2, XCircle, Hash, History, Clock, Trash2, Radio, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { FeedbackSection } from "./_feedback-section";
import { ImProductSection } from "./_im-product-section";
import { BlastFolderPicker, type BlastFolderOption } from "../../_edoc-app";
import { MultiSelect, type MultiSelectOption } from "../../_edoc-multiselect";

type FileDetail = {
  id: string; folderId: string; title: string; description: string | null; fileUrl: string;
  requiresNumber: boolean; requiresItemImport: boolean; documentNumber: string | null; mocNumber: string | null; status: string;
  bulkImported: boolean;
  approvalNote: string | null; approvedAt: string | null;
  rejectionNote: string | null; rejectedAt: string | null;
  businessUnitCodes: string[]; branchIds: string[]; organizationId: string | null;
  startDate: string | null; endDate: string | null; obsoleteDestinationFolderId: string | null; createdAt: string;
  categoryId: string; category: { id: string; code: string; name: string } | null;
  categoryTypeId: string | null; categoryType: { id: string; code: string; name: string } | null;
  uploader: { id: string; name: string | null; employeeId: string };
  approver: { id: string; name: string | null } | null;
  rejecter: { id: string; name: string | null } | null;
  revisions: { id: string; previousFileUrl: string; replacedAt: string; replacer: { name: string | null } }[];
};
type Reference = {
  branches: MultiSelectOption[]; businessUnits: { code: string; name: string }[];
  organizations: { id: string; name: string; code: string | null }[];
  categories: { id: string; code: string; name: string; categoryTypes: { id: string; code: string; name: string }[] }[];
  branchPrefixMappings: { prefix: string; businessUnitCodes: string[] }[];
};

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", RELEASE: "Release", REJECTED: "Rejected" };
const STATUS_COLOR: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-600", RELEASE: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700" };

export default function EDocFileDetailPage() {
  const { appSlug, fileId } = useParams<{ appSlug: string; fileId: string }>();
  const router = useRouter();
  // "Back" ke folder asal file ini, bukan ke root E Document (2026-09-22) — folder
  // navigation di EDocApp murni state client, tidak pernah masuk browser history, jadi
  // router.back() polos selalu mendarat di root, bukan folder yang lagi dibuka user
  // sebelumnya. file.folderId sendiri (bukan query param) yang dipakai — selalu ada begitu
  // file-nya sudah termuat, jadi tetap benar dilihat dari mana pun halaman ini dibuka
  // (klik dari list, dari search, atau link langsung).
  const backToFolder = (folderId: string) => router.push(`/apps/${appSlug}?folderId=${folderId}`);

  const [file, setFile] = useState<FileDetail | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canManageBlast, setCanManageBlast] = useState(false);
  const [canEditMetadata, setCanEditMetadata] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDocumentApprover, setIsDocumentApprover] = useState(false);
  const [blastFolders, setBlastFolders] = useState<BlastFolderOption[]>([]);
  const [blastSaving, setBlastSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approveNote, setApproveNote] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [generatingMoc, setGeneratingMoc] = useState(false);
  const [revising, setRevising] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const revisionFileRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/edoc/file/${fileId}`);
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "File tidak ditemukan"); return; }
      setFile(json.data);
      setCanWrite(!!json.canWrite);
      setCanDelete(!!json.canDelete);
      setCanManageBlast(!!json.canManageBlast);
      setCanEditMetadata(!!json.canEditMetadata);
      setIsDocumentApprover(!!json.isDocumentApprover);
    } finally { setLoading(false); }
  }, [fileId]);

  const loadBlast = useCallback(async () => {
    const res = await fetch(`/api/edoc/file/${fileId}/blast`);
    const json = await res.json().catch(() => ({}));
    setBlastFolders(res.ok ? (json.data ?? []) : []);
  }, [fileId]);

  useEffect(() => { void load(); void loadBlast(); }, [load, loadBlast]);
  useEffect(() => {
    fetch("/api/edoc/reference").then((r) => r.json()).then(setReference).catch(() => {});
  }, []);

  // Diffing selection lama vs baru dari BlastFolderPicker -> POST yang baru ditambah,
  // DELETE satu-satu yang dilepas (chip × di dalam picker juga lewat sini).
  const handleBlastChange = async (next: BlastFolderOption[]) => {
    const added = next.filter((f) => !blastFolders.some((b) => b.id === f.id));
    const removedIds = blastFolders.filter((f) => !next.some((n) => n.id === f.id)).map((f) => f.id);
    setBlastFolders(next);
    setBlastSaving(true);
    try {
      if (added.length > 0) {
        const res = await fetch(`/api/edoc/file/${fileId}/blast`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderIds: added.map((f) => f.id) }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); showToast("error", j.message || "Gagal menambah blast"); }
      }
      for (const fid of removedIds) {
        await fetch(`/api/edoc/file/${fileId}/blast?folderId=${fid}`, { method: "DELETE" });
      }
      if (added.length > 0 || removedIds.length > 0) showToast("success", "Blast diperbarui");
    } finally {
      setBlastSaving(false);
      void loadBlast();
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/edoc/file/${fileId}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: approveNote.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal approve"); return; }
      showToast("success", "Dokumen berhasil di-approve");
      void load();
    } finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { showToast("error", "Alasan reject wajib diisi"); return; }
    setRejecting(true);
    try {
      const res = await fetch(`/api/edoc/file/${fileId}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal reject"); return; }
      showToast("success", "Dokumen di-reject");
      setShowRejectForm(false); setRejectReason("");
      void load();
    } finally { setRejecting(false); }
  };

  const handleGenerateMoc = async () => {
    setGeneratingMoc(true);
    try {
      const res = await fetch(`/api/edoc/file/${fileId}/moc`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal generate MOC Number"); return; }
      showToast("success", "MOC Number berhasil digenerate");
      void load();
    } finally { setGeneratingMoc(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus file "${file?.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/edoc/file/${fileId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showToast("error", json.message || "Gagal menghapus file"); return; }
      showToast("success", "File berhasil dihapus");
      if (file) backToFolder(file.folderId); else router.back();
    } finally { setDeleting(false); }
  };

  const handleRevision = async (f: File) => {
    setRevising(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/edoc/file/${fileId}/revision`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal upload revisi"); return; }
      showToast("success", "Revisi berhasil diupload");
      void load();
    } finally { setRevising(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...</div>;
  }
  if (!file) return null;

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-[90] min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => backToFolder(file.folderId)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 truncate">{file.title}</h1>
            <p className="text-xs text-slate-400">{file.category ? `${file.category.code} — ${file.category.name}` : "-"}{file.categoryType ? ` · ${file.categoryType.name}` : ""}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[file.status] ?? "bg-slate-100 text-slate-600"}`}>
            {STATUS_LABEL[file.status] ?? file.status}
          </span>
          {file.documentNumber && (
            <span className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              <Hash className="w-3 h-3" /> {file.documentNumber}
            </span>
          )}
          {file.mocNumber && (
            <span className="inline-flex items-center gap-1 text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              MOC: {file.mocNumber}
            </span>
          )}
          {file.bulkImported && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700" title="Hasil Bulk Import — lengkapi datanya lewat tombol Edit">
              Bulk Import
            </span>
          )}
        </div>

        {file.description && <p className="text-sm text-slate-600">{file.description}</p>}

        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
          <span>Diupload oleh: {file.uploader.name ?? file.uploader.employeeId}</span>
          <span>{new Date(file.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
          {file.startDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Berlaku dari: {new Date(file.startDate).toLocaleDateString("id-ID")}</span>}
          {file.endDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> s/d: {new Date(file.endDate).toLocaleDateString("id-ID")}</span>}
        </div>

        {(file.businessUnitCodes.length > 0 || file.branchIds.length > 0) && (
          <div className="flex items-start gap-4 text-xs text-slate-500 flex-wrap pt-2 border-t border-slate-100">
            {file.businessUnitCodes.length > 0 && (
              <div>
                <span className="text-slate-400">Business Unit: </span>
                {file.businessUnitCodes.map((code) => (
                  <span key={code} className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-1 mb-1">
                    {reference?.businessUnits.find((b) => b.code === code)?.name ?? code}
                  </span>
                ))}
              </div>
            )}
            {file.branchIds.length > 0 && (
              <div>
                <span className="text-slate-400">Branch: </span>
                {file.branchIds.map((id) => (
                  <span key={id} className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-1 mb-1">
                    {reference?.branches.find((b) => b.id === id)?.name ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {(canManageBlast || blastFolders.length > 0) && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
              <Radio className="w-3.5 h-3.5" /> Blast {blastSaving && <Loader2 className="w-3 h-3 animate-spin" />}
            </p>
            {canManageBlast ? (
              <BlastFolderPicker selected={blastFolders} onChange={handleBlastChange} />
            ) : blastFolders.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {blastFolders.map((f) => (
                  <span key={f.id} title={f.path} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{f.path || f.name}</span>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-slate-400 mt-1">File ini juga muncul di folder di atas (link, bukan disalin) — hilang otomatis dari semua kalau file expired/Obsolete/dihapus.</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <a href={`/api/edoc/file/${fileId}/download`} target="_blank" rel="noreferrer">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Lihat / Download PDF
            </Button>
          </a>
          {canWrite && (
            <>
              <input
                ref={revisionFileRef} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleRevision(f); }}
              />
              <Button variant="outline" disabled={revising} onClick={() => revisionFileRef.current?.click()} className="flex items-center gap-2">
                {revising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {revising ? "Mengupload..." : "Upload Revisi"}
              </Button>
            </>
          )}
          {canEditMetadata && (
            <Button variant="outline" onClick={() => setShowEditModal(true)} className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" disabled={deleting} onClick={handleDelete} className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Menghapus..." : "Hapus File"}
            </Button>
          )}
        </div>

        {file.revisions.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5"><History className="w-3.5 h-3.5" /> Riwayat Revisi</p>
            <div className="space-y-1">
              {file.revisions.map((r) => (
                <p key={r.id} className="text-xs text-slate-400">
                  {new Date(r.replacedAt).toLocaleString("id-ID")} oleh {r.replacer.name ?? "-"}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info reject — kelihatan buat siapapun yang bisa lihat file ini (uploader wajib tahu
          alasannya, bukan cuma approver) — file REJECTED sudah digate sama seperti DRAFT
          (cuma uploader/approver/superadmin bisa buka halaman ini sama sekali). */}
      {file.status === "REJECTED" && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-700 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Ditolak oleh {file.rejecter?.name ?? "-"}
            {file.rejectedAt && <span className="font-normal text-red-500">— {new Date(file.rejectedAt).toLocaleString("id-ID")}</span>}
          </p>
          {file.rejectionNote && <p className="text-sm text-red-600 mt-1">Alasan: {file.rejectionNote}</p>}
          <p className="text-xs text-red-400 mt-2">Upload revisi untuk memperbaiki dan mengajukan ulang — status akan otomatis kembali ke Draft.</p>
        </div>
      )}

      {/* Approval Document actions */}
      {isDocumentApprover && file.requiresNumber && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600" /> Aksi Document Approver
          </p>
          {file.status === "DRAFT" ? (
            <div className="space-y-3">
              <textarea className={inputCls} rows={2} placeholder="Catatan approval (opsional)" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
              <div className="flex items-center gap-2">
                <Button onClick={handleApprove} disabled={approving || rejecting} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
                  {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {approving ? "Memproses..." : "Approve & Generate Document Number"}
                </Button>
                <Button
                  variant="outline" disabled={approving || rejecting} onClick={() => setShowRejectForm((v) => !v)}
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
              {showRejectForm && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Alasan Reject <span className="text-red-500">*</span></label>
                  <textarea className={inputCls} rows={2} placeholder="Wajib diisi — jelaskan alasan reject" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  <Button onClick={handleReject} disabled={rejecting || !rejectReason.trim()} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
                    {rejecting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {rejecting ? "Memproses..." : "Konfirmasi Reject"}
                  </Button>
                </div>
              )}
            </div>
          ) : file.status === "RELEASE" && file.approvalNote ? (
            <p className="text-sm text-slate-500">Catatan: {file.approvalNote}</p>
          ) : null}

          {file.status === "RELEASE" && !file.mocNumber && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Button onClick={handleGenerateMoc} disabled={generatingMoc} variant="outline" className="flex items-center gap-2">
                {generatingMoc && <Loader2 className="w-4 h-4 animate-spin" />}
                {generatingMoc ? "Memproses..." : "Generate MOC Number"}
              </Button>
              <p className="text-xs text-slate-400 mt-1">Opsional per Category — kalau Category ini belum punya format MOC, ini akan gagal dengan pesan yang jelas.</p>
            </div>
          )}
        </div>
      )}

      <FeedbackSection fileId={fileId} uploaderId={file.uploader.id} />

      {file.category?.code === "IM" && file.requiresItemImport && (
        <ImProductSection fileId={fileId} uploaderId={file.uploader.id} bulkImported={file.bulkImported} />
      )}

      {showEditModal && reference && (
        <EditFileModal
          file={file}
          reference={reference}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); void load(); showToast("success", "Metadata file berhasil disimpan"); }}
          onError={(m) => showToast("error", m)}
        />
      )}
    </div>
  );
}

// ===================== Edit File Metadata Modal =====================
// Dibuat terutama untuk melengkapi file hasil Bulk Import (2026-09-21, lihat "Bulk Import"
// badge di atas) yang sengaja dibuat minim data saat upload — TIDAK mengganti file PDF-nya
// sendiri (tetap lewat "Upload Revisi") atau import item promo (tetap lewat section
// "Produk/Promo Terkait" begitu Category IM + toggle promo di sini dinyalakan). Akses
// digate server-side oleh canEditFileMetadata — tombol "Edit" sendiri sudah cuma muncul
// kalau canEditMetadata true, jadi form ini tidak perlu cek ulang di client.
function branchPrefixOf(name: string): string {
  const idx = name.indexOf(" - ");
  return idx === -1 ? name.trim() : name.slice(0, idx).trim();
}

function EditFileModal({
  file, reference, onClose, onSaved, onError,
}: {
  file: FileDetail; reference: Reference;
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description ?? "");
  const [categoryId, setCategoryId] = useState(file.categoryId);
  const [categoryTypeId, setCategoryTypeId] = useState(file.categoryTypeId ?? "");
  const [businessUnitCodes, setBusinessUnitCodes] = useState<string[]>(file.businessUnitCodes);
  const [branchIds, setBranchIds] = useState<string[]>(file.branchIds);
  const [organizationId, setOrganizationId] = useState(file.organizationId ?? "");
  const [startDate, setStartDate] = useState(file.startDate ? file.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(file.endDate ? file.endDate.slice(0, 10) : "");
  const [obsoleteDestinationFolderId, setObsoleteDestinationFolderId] = useState(file.obsoleteDestinationFolderId ?? "");
  const [obsoleteFolders, setObsoleteFolders] = useState<{ id: string; name: string }[]>([]);
  const [documentNumber, setDocumentNumber] = useState(file.documentNumber ?? "");
  const [mocNumber, setMocNumber] = useState(file.mocNumber ?? "");
  const [requiresItemImport, setRequiresItemImport] = useState(file.requiresItemImport);
  const [saving, setSaving] = useState(false);

  const selectedCategory = reference.categories.find((c) => c.id === categoryId);

  // Sama persis logic auto-link BU<->Branch di UploadFileModal (_edoc-app.tsx) — lihat
  // komentar di sana untuk penjelasan lengkap trade-off-nya.
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

  useEffect(() => {
    fetch(`/api/edoc/folder/obsolete-destinations?parentFolderId=${file.folderId}`)
      .then((r) => r.json())
      .then((j) => setObsoleteFolders(j.data ?? []))
      .catch(() => {});
  }, [file.folderId]);

  const submit = async () => {
    if (!title.trim()) { onError("Title tidak boleh kosong"); return; }
    if (endDate && !obsoleteDestinationFolderId) { onError("Pilih folder tujuan Obsolete jika mengisi end date"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/edoc/file/${file.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryId,
          categoryTypeId: categoryTypeId || null,
          businessUnitCodes,
          branchIds,
          organizationId: organizationId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          obsoleteDestinationFolderId: obsoleteDestinationFolderId || null,
          documentNumber: documentNumber.trim(),
          mocNumber: mocNumber.trim(),
          requiresItemImport,
        }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menyimpan"); return; }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Modal open title="Edit Metadata File" onClose={onClose} boxClassName="max-w-2xl">
      <div className="space-y-4">
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
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setCategoryTypeId(""); }}>
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
          </div>
        </div>

        {endDate && (
          <div>
            <label className={labelCls}>Folder Tujuan Obsolete <span className="text-red-500">*</span></label>
            <select className={inputCls} value={obsoleteDestinationFolderId} onChange={(e) => setObsoleteDestinationFolderId(e.target.value)}>
              <option value="">-</option>
              {obsoleteFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nomor Dokumen</label>
            <input className={inputCls} value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Diketik manual, misal nomor arsip lama" />
          </div>
          <div>
            <label className={labelCls}>MOC Number</label>
            <input className={inputCls} value={mocNumber} onChange={(e) => setMocNumber(e.target.value)} />
          </div>
        </div>

        {selectedCategory?.code === "IM" && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={requiresItemImport} onChange={(e) => setRequiresItemImport(e.target.checked)} className="rounded border-slate-300" />
            File ini promo (butuh lampiran item) — import Excel-nya lewat section &ldquo;Produk/Promo Terkait&rdquo; setelah disimpan
          </label>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={submit} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </div>
      </div>
    </Modal>
  );
}
