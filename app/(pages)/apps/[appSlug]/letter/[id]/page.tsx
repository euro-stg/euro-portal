"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, FileSignature, CheckCircle2, XCircle, Clock, Send,
  Upload, Loader2, ChevronRight, FileCheck, X, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";


type ApprovalStep = {
  id: string; step: number; label: string; status: string;
  actorId: string | null; note: string | null; actedAt: string | null;
  actor: { id: string; name: string | null } | null;
  jobPositionName: string | null; organizationName: string | null;
};

type Letter = {
  id: string; letterNo: string | null; title: string; tujuan: string | null;
  status: string; fileDraft: string | null; fileFinal: string | null;
  createdAt: string; updatedAt: string | null;
  category: { id: string; code: string; name: string; hasDraft: boolean };
  department: { id: string; code: string; name: string };
  company: { id: string; code: string; name: string };
  requester: { id: string; name: string | null; jobPositionName: string | null; organizationName: string | null };
  pic: { id: string; name: string | null; jobPositionName: string | null } | null;
  approval: {
    id: string; status: string; currentStep: number;
    template: { id: string; name: string };
    steps: ApprovalStep[];
  } | null;
  activities: {
    id: string; action: string; note: string | null; createdAt: string;
    actor: { id: string; name: string | null };
  }[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Menunggu Approval",
  APPROVED: "Disetujui", REJECTED: "Ditolak", DONE: "Selesai",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-700",
  DONE: "bg-emerald-50 text-emerald-700",
};
const ACTION_LABEL: Record<string, string> = {
  CREATED: "Dibuat", SUBMITTED: "Diajukan", APPROVED: "Disetujui",
  APPROVED_STEP: "Step Disetujui", REJECTED: "Ditolak", DONE: "Selesai",
};

export default function LetterDetailPage() {
  const { appSlug, id } = useParams<{ appSlug: string; id: string }>();
  const router = useRouter();

  const [letter,     setLetter]     = useState<Letter | null>(null);
  const [isOwner,    setIsOwner]    = useState(false);
  const [isApprover, setIsApprover] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const [submitting, setSubmitting]   = useState(false);
  const [approveModal, setApproveModal] = useState<{ action: "APPROVED" | "REJECTED" } | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approving, setApproving]     = useState(false);

  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile,  setUploadFile]  = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ssd/letter/${id}`);
      const json = await res.json();
      if (res.ok) { setLetter(json.data); setIsOwner(json.isOwner ?? false); setIsApprover(json.isApprover ?? false); }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ssd/letter/${id}/submit`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal mengajukan"); return; }
      showToast("success", "Surat berhasil diajukan");
      void load();
    } finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    if (approveModal.action === "REJECTED" && !approveNote.trim()) {
      showToast("error", "Catatan penolakan wajib diisi"); return;
    }
    setApproving(true);
    try {
      const res = await fetch(`/api/ssd/letter/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: approveModal.action, note: approveNote }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal memproses"); return; }
      showToast("success", json.message);
      setApproveModal(null);
      setApproveNote("");
      void load();
    } finally { setApproving(false); }
  };

  const handleUploadFinal = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch(`/api/ssd/letter/${id}/upload-final`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Upload gagal"); return; }
      showToast("success", "File final berhasil diupload");
      setUploadModal(false);
      setUploadFile(null);
      void load();
    } finally { setUploading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Surat tidak ditemukan</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 text-sm">Kembali</button>
      </div>
    );
  }

  const activeStep = letter.approval?.steps.find(
    (s) => s.step === letter.approval?.currentStep && s.status === "PENDING"
  );

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => router.push(`/apps/${appSlug}/letter`)}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {letter.letterNo ? (
              <span className="font-mono text-sm bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-100">
                {letter.letterNo}
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-mono">Nomor belum ditetapkan</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[letter.status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABEL[letter.status] ?? letter.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">{letter.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span>{letter.category.code} — {letter.category.name}</span>
            <ChevronRight className="w-3 h-3" />
            <span>{letter.company.code} — {letter.company.name}</span>
            <ChevronRight className="w-3 h-3" />
            <span>{letter.department.code} — {letter.department.name}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dibuat oleh {letter.requester.name} • {new Date(letter.createdAt).toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {letter.status === "DRAFT" && (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? "Mengajukan..." : "Ajukan untuk Approval"}
          </Button>
        )}
        {isApprover && (
          <>
            <Button
              onClick={() => { setApproveModal({ action: "APPROVED" }); setApproveNote(""); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Setujui
            </Button>
            <Button
              onClick={() => { setApproveModal({ action: "REJECTED" }); setApproveNote(""); }}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Tolak
            </Button>
          </>
        )}
        {letter.status === "APPROVED" && isOwner && (
          <Button
            onClick={() => setUploadModal(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload File Final
          </Button>
        )}
        {letter.status === "DRAFT" && (
          <Button
            variant="outline"
            onClick={() => router.push(`/apps/${appSlug}/letter/${id}/edit`)}
          >
            Edit Surat
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        {/* Info Surat */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-violet-500" /> Informasi Surat
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Perihal</p>
              <p className="font-medium text-slate-800">{letter.title}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tujuan</p>
              <p className="font-medium text-slate-800">{letter.tujuan ?? <span className="text-slate-400 font-normal">—</span>}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Kategori</p>
              <p className="font-medium text-slate-800">{letter.category.code} — {letter.category.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">PIC</p>
              <p className="font-medium text-slate-800">
                {letter.pic ? (
                  <>
                    {letter.pic.name}
                    {letter.pic.jobPositionName && <span className="text-slate-400 font-normal ml-1">· {letter.pic.jobPositionName}</span>}
                  </>
                ) : (
                  <span className="text-slate-400 font-normal">—</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Perusahaan</p>
              <p className="font-medium text-slate-800">{letter.company.code} — {letter.company.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Departemen</p>
              <p className="font-medium text-slate-800">{letter.department.code} — {letter.department.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Requestor</p>
              <p className="font-medium text-slate-800">
                {letter.requester.name}
                {letter.requester.jobPositionName && <span className="text-slate-400 font-normal ml-1">· {letter.requester.jobPositionName}</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tanggal Buat</p>
              <p className="font-medium text-slate-800">{new Date(letter.createdAt).toLocaleString("id-ID")}</p>
            </div>
          </div>

          {/* Files */}
          {(letter.fileDraft || letter.fileFinal) && (
            <div className="mt-5 space-y-2">
              {letter.fileDraft && (
                <a
                  href={`/api/ssd/file?path=${encodeURIComponent(letter.fileDraft)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg p-2.5 hover:bg-amber-100 transition-colors group"
                >
                  <FileCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-amber-700">File Draft:</span>
                  <span className="font-mono truncate text-amber-600 group-hover:underline">{letter.fileDraft}</span>
                </a>
              )}
              {letter.fileFinal && (
                <a
                  href={`/api/ssd/file?path=${encodeURIComponent(letter.fileFinal)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 hover:bg-emerald-100 transition-colors group"
                >
                  <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-medium text-emerald-700">File Final:</span>
                  <span className="font-mono truncate text-emerald-600 group-hover:underline">{letter.fileFinal}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Approval Steps */}
        {letter.approval && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Proses Approval
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                letter.approval.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" :
                letter.approval.status === "REJECTED" ? "bg-red-50 text-red-700" :
                "bg-amber-50 text-amber-700"
              }`}>
                {letter.approval.status}
              </span>
            </h2>
            <div className="space-y-3">
              {letter.approval.steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    step.status === "APPROVED" ? "border-emerald-100 bg-emerald-50" :
                    step.status === "REJECTED" ? "border-red-100 bg-red-50" :
                    step.step === letter.approval!.currentStep ? "border-amber-100 bg-amber-50" :
                    "border-slate-100 bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.status === "APPROVED" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {step.status === "REJECTED" && <XCircle className="w-4 h-4 text-red-500" />}
                    {step.status === "PENDING" && step.step === letter.approval!.currentStep && (
                      <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                    )}
                    {step.status === "PENDING" && step.step !== letter.approval!.currentStep && (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">Step {step.step}:</span>
                      <span className="text-xs text-slate-700 font-semibold">{step.label}</span>
                      {step.jobPositionName && (
                        <span className="text-xs text-slate-400">({step.jobPositionName})</span>
                      )}
                    </div>
                    {step.actor && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {step.actor.name} • {step.actedAt ? new Date(step.actedAt).toLocaleString("id-ID") : ""}
                      </p>
                    )}
                    {step.note && (
                      <p className="text-xs text-slate-600 mt-1 italic bg-white/70 rounded px-2 py-1">{step.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log Aktivitas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" /> Log Aktivitas
          </h2>
          {letter.activities.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada aktivitas</p>
          ) : (
            <div className="space-y-3">
              {letter.activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-violet-500">
                      {act.actor.name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700">{act.actor.name}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-400">
                        {new Date(act.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {ACTION_LABEL[act.action] ?? act.action}
                      </span>
                    </div>
                    {act.note && <p className="text-sm text-slate-600">{act.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approve / Reject Modal */}
      {approveModal && (
        <Modal
          open
          title={approveModal.action === "APPROVED" ? "Setujui Surat" : "Tolak Surat"}
          onClose={() => { setApproveModal(null); setApproveNote(""); }}
          boxClassName="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {approveModal.action === "APPROVED"
                ? `Anda akan menyetujui surat "${letter.title}" pada step ${letter.approval?.currentStep}: ${activeStep?.label}.`
                : `Anda akan menolak surat "${letter.title}". Catatan penolakan wajib diisi.`
              }
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Catatan {approveModal.action === "REJECTED" && <span className="text-red-500">*</span>}
              </label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-h-[100px] resize-y"
                placeholder={approveModal.action === "REJECTED" ? "Alasan penolakan (wajib)..." : "Catatan opsional..."}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleApprove()}
                disabled={approving}
                className={`flex-1 text-white flex items-center justify-center gap-2 ${
                  approveModal.action === "APPROVED"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                {approveModal.action === "APPROVED" ? "Setujui" : "Tolak"}
              </Button>
              <Button variant="outline" onClick={() => { setApproveModal(null); setApproveNote(""); }}>
                Batal
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Final Modal */}
      <Modal
        open={uploadModal}
        title="Upload File Final"
        onClose={() => { setUploadModal(false); setUploadFile(null); }}
        boxClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload file surat final (PDF, Word, atau gambar) yang sudah ditandatangani untuk menutup surat ini.
          </p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
          />
          {uploadFile ? (
            <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-100 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-violet-800 truncate">{uploadFile.name}</p>
                <p className="text-xs text-violet-500">{(uploadFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => { setUploadFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-slate-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Klik untuk pilih file
            </button>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => void handleUploadFinal()}
              disabled={!uploadFile || uploading}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Mengupload..." : "Upload"}
            </Button>
            <Button variant="outline" onClick={() => { setUploadModal(false); setUploadFile(null); }}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
