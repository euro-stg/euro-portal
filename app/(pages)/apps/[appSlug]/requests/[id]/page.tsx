"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  Plus, Pencil, Globe, Calendar, CheckCheck, X, Send, Paperclip,
  Download, User, Trash2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────────
type Actor  = { id: string; name: string | null };
type EnvRow = { id: string; name: string; url: string; username: string | null; password: string | null; note: string | null };
type ProgressRow = { id: string; label: string; status: string; note: string | null; order: number };
type AttachRow   = { id: string; name: string; path: string; size: number | null; createdAt: string; category: string; uploader?: Actor };
type ActivityRow = { id: string; action: string; note: string | null; createdAt: string; actor: Actor };

type ApprovalStep = {
  id: string; step: number; label: string;
  jobPositionId: string | null; jobPositionName: string | null;
  organizationId: string | null; organizationName: string | null;
  branchId: string | null; branchName: string | null;
  status: string; actorId: string | null; note: string | null; actedAt: string | null;
  actor: Actor | null;
};

type MyProfile = { id: string; jobPositionId: string | null; organizationId: string | null; branchId: string | null; hasAnyAppRole?: boolean };

type ApprovalRequest = { id: string; status: string; currentStep: number; steps: ApprovalStep[] };

type ItDoc = {
  id: string; content: string; createdAt: string; updatedAt: string | null;
  creator: Actor; approver: Actor | null; approvedAt: string | null;
  attachments: AttachRow[];
};

type UatRevision = {
  id: string; iteration: number; note: string | null; createdAt: string;
  creator: Actor;
  attachments: AttachRow[];
};

type SdRequest = {
  id: string; requestNo: string; type: string; title: string; description: string;
  status: string; estimatedCompletedAt: string | null; createdAt: string; updatedAt: string | null;
  requester: Actor & { jobPositionName: string | null; organizationName: string | null };
  pic: Actor | null;
  refApp: { id: string; name: string } | null;
  itDocument: ItDoc | null;
  progresses: ProgressRow[];
  environments: EnvRow[];
  uat: { id: string; note: string | null; approvedBy: string | null; approvedAt: string | null; approver: Actor | null } | null;
  uatRevisions: UatRevision[];
  attachments: AttachRow[];
  activities: ActivityRow[];
  approvalRequest: ApprovalRequest | null;
};

type UserOption = { id: string; name: string | null; jobPositionName: string | null; organizationName: string | null; branchName: string | null };

// ─── Constants ────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Diajukan", IT_REVIEW: "Review IT",
  APPROVED_IT: "Menunggu Persetujuan User", APPROVED_USER: "Disetujui User",
  IN_PROGRESS: "Dalam Pengembangan", UAT: "UAT", UAT_REVISION: "Revisi UAT",
  DONE: "Selesai", REJECTED: "Ditolak", CANCELLED: "Dibatalkan",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  IT_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED_IT: "bg-orange-50 text-orange-700",
  APPROVED_USER: "bg-teal-50 text-teal-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  UAT: "bg-purple-50 text-purple-700",
  UAT_REVISION: "bg-pink-50 text-pink-700",
  DONE: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};
const ACTION_LABEL: Record<string, string> = {
  CREATED: "Pengajuan dibuat",
  SUBMITTED: "Pengajuan disubmit",
  APPROVAL_CREATED: "Menunggu approval",
  IT_REVIEW: "IT mulai review",
  IT_DOC_SAVED: "Dokumen IT disimpan",
  USER_APPROVED_DOC: "User menyetujui dokumen IT",
  APPROVED_USER: "Pengajuan disetujui user",
  IN_PROGRESS: "Development dimulai",
  PROGRESS_UPDATE: "Progress diperbarui",
  ENV_ADDED: "Environment ditambahkan",
  UAT_READY: "Siap UAT",
  UAT_APPROVED: "UAT disetujui",
  UAT_REVISION: "UAT dikembalikan untuk revisi",
  DONE: "Pengajuan selesai",
  REJECTED: "Pengajuan ditolak",
  CANCELLED: "Pengajuan dibatalkan",
  ASSIGN_PIC: "PIC di-assign",
};

const inputCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

const DEFAULT_STAGES = [
  { label: "Design", status: "IN_PROGRESS", note: "", order: 1 },
  { label: "Backend", status: "IN_PROGRESS", note: "", order: 2 },
  { label: "Frontend", status: "IN_PROGRESS", note: "", order: 3 },
  { label: "Testing", status: "IN_PROGRESS", note: "", order: 4 },
  { label: "Deployment", status: "IN_PROGRESS", note: "", order: 5 },
];

// ─── Attachment upload helper ─────────────────────────────────────
function AttachUploader({
  requestId, category, onDone,
}: { requestId: string; category: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      const res = await fetch(`/api/sd/request/${requestId}/upload`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
        {uploading ? "Mengunggah..." : "Lampirkan File"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Attachment list helper ───────────────────────────────────────
function AttachList({ items }: { items: AttachRow[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((a) => (
        <a key={a.id} href={a.path} target="_blank" rel="noopener noreferrer"
          className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition-colors group">
          <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate group-hover:text-blue-700">{a.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {a.uploader?.name ?? "—"} · {new Date(a.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <Download className="w-3 h-3 text-slate-300 group-hover:text-blue-400 shrink-0 mt-0.5" />
        </a>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────
export default function RequestDetailPage() {
  const { appSlug, id } = useParams<{ appSlug: string; id: string }>();
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [data, setData] = useState<SdRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  // IT Document
  const [itDocOpen, setItDocOpen] = useState(false);
  const [itDocContent, setItDocContent] = useState("");
  const [itDocSaving, setItDocSaving] = useState(false);

  // Approve IT Doc
  const [approveDocOpen, setApproveDocOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [approving, setApproving] = useState(false);

  // Progress
  const [progressOpen, setProgressOpen] = useState(false);
  const [stages, setStages] = useState(DEFAULT_STAGES.map(s => ({ ...s })));
  const [progressSaving, setProgressSaving] = useState(false);

  // Environment
  const [envOpen, setEnvOpen] = useState(false);
  const [envForm, setEnvForm] = useState({ name: "", url: "", username: "", password: "", note: "" });
  const [envSaving, setEnvSaving] = useState(false);

  // UAT
  const [uatOpen, setUatOpen] = useState(false);
  const [uatNote, setUatNote] = useState("");
  const [uatSaving, setUatSaving] = useState(false);

  // UAT Approve (requester Finish)
  const [uatApproveOpen, setUatApproveOpen] = useState(false);
  const [uatApproveNote, setUatApproveNote] = useState("");
  const [uatApproving, setUatApproving] = useState(false);

  // UAT Revision (requester)
  const [uatRevOpen, setUatRevOpen] = useState(false);
  const [uatRevNote, setUatRevNote] = useState("");
  const [uatRevFiles, setUatRevFiles] = useState<File[]>([]);
  const [uatRevSaving, setUatRevSaving] = useState(false);
  const uatRevFileRef = useRef<HTMLInputElement>(null);

  const [transitioning, setTransitioning] = useState(false);

  // Cancel (requester)
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Reject (IT PIC)
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Assign PIC
  const [picOpen, setPicOpen] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedPic, setSelectedPic] = useState<string>("");
  const [picSaving, setPicSaving] = useState(false);

  // Edit estimasi selesai
  const [estimasiOpen, setEstimasiOpen] = useState(false);
  const [estimasiVal, setEstimasiVal] = useState("");
  const [estimasiSaving, setEstimasiSaving] = useState(false);

  // Soft delete (superadmin)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Approval act
  const [approvalActOpen, setApprovalActOpen] = useState(false);
  const [approvalActAction, setApprovalActAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvalActNote, setApprovalActNote] = useState("");
  const [approvalActing, setApprovalActing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ variant, message });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/sd/request/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal memuat");
      setData(json.data);
      if (json.data.progresses?.length) setStages(json.data.progresses);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((j) => {
      if (j.id) setMyProfile(j as MyProfile);
      if (j.role === "superadmin") setIsSuperadmin(true);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load users for PIC selection
  const loadUsers = useCallback(async (q: string) => {
    const res = await fetch(`/api/sd/users?q=${encodeURIComponent(q)}`);
    const j = await res.json();
    setUserOptions(j.data ?? []);
  }, []);

  useEffect(() => {
    if (picOpen) loadUsers(userSearch);
  }, [picOpen, userSearch, loadUsers]);

  // ─── Actions ─────────────────────────────────────────────────
  const patchStatus = async (action: string, note?: string) => {
    const res = await fetch(`/api/sd/request/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.message);
    return j;
  };

  const handleSubmit = async () => {
    try { await patchStatus("SUBMITTED", "Pengajuan disubmit"); showToast("success", "Pengajuan berhasil disubmit"); load(); }
    catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
  };

  const handleSaveItDoc = async () => {
    if (!itDocContent.trim()) { showToast("error", "Konten dokumen wajib diisi"); return; }
    setItDocSaving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}/it-document`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: itDocContent }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Dokumen IT disimpan"); setItDocOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setItDocSaving(false); }
  };

  const handleApproveDoc = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}/it-document/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: approveNote }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Dokumen IT disetujui"); setApproveDocOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setApproving(false); }
  };

  const handleSaveProgress = async () => {
    setProgressSaving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}/progress`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Progress diperbarui"); setProgressOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setProgressSaving(false); }
  };

  const handleAddEnv = async () => {
    setEnvSaving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}/environment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envForm),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Environment ditambahkan"); setEnvOpen(false);
      setEnvForm({ name: "", url: "", username: "", password: "", note: "" }); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setEnvSaving(false); }
  };

  const handleMarkUat = async () => {
    setUatSaving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}/uat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: uatNote }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Status diubah ke UAT"); setUatOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setUatSaving(false); }
  };

  const handleApproveUat = async () => {
    setUatApproving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}/uat/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: uatApproveNote }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "UAT selesai — pengajuan DONE"); setUatApproveOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setUatApproving(false); }
  };

  const handleUatRevision = async () => {
    setUatRevSaving(true);
    try {
      const fd = new FormData();
      if (uatRevNote.trim()) fd.append("note", uatRevNote.trim());
      uatRevFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`/api/sd/request/${id}/uat/revision`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);

      showToast("success", "UAT dikembalikan untuk revisi");
      setUatRevOpen(false);
      setUatRevNote("");
      setUatRevFiles([]);
      load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setUatRevSaving(false); }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await patchStatus("CANCELLED", cancelNote || "Pengajuan dibatalkan oleh pengaju");
      showToast("success", "Pengajuan dibatalkan"); setCancelOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setCancelling(false); }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await patchStatus("REJECTED", rejectNote);
      showToast("success", "Pengajuan ditolak"); setRejectOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setRejecting(false); }
  };

  const handleAssignPic = async () => {
    if (!selectedPic) { showToast("error", "Pilih PIC terlebih dahulu"); return; }
    setPicSaving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picId: selectedPic, note: "PIC di-assign" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "PIC berhasil di-assign"); setPicOpen(false); setSelectedPic(""); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setPicSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sd/request/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Pengajuan dihapus");
      setDeleteOpen(false);
      router.push(`/apps/${appSlug}/requests`);
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setDeleting(false); }
  };

  const handleSaveEstimasi = async () => {
    setEstimasiSaving(true);
    try {
      const res = await fetch(`/api/sd/request/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedCompletedAt: estimasiVal || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Target selesai diperbarui"); setEstimasiOpen(false); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setEstimasiSaving(false); }
  };

  const openEstimasi = () => {
    setEstimasiVal(data?.estimatedCompletedAt ? data.estimatedCompletedAt.slice(0, 10) : "");
    setEstimasiOpen(true);
  };

  const openApprovalAct = (action: "APPROVED" | "REJECTED") => {
    setApprovalActAction(action); setApprovalActNote(""); setApprovalActOpen(true);
  };

  const handleApprovalAct = async () => {
    if (!data?.approvalRequest) return;
    setApprovalActing(true);
    try {
      const res = await fetch(`/api/sd/approval/request/${data.approvalRequest.id}/act`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: approvalActAction, note: approvalActNote }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", approvalActAction === "APPROVED" ? "Step disetujui" : "Pengajuan ditolak");
      setApprovalActOpen(false); setApprovalActNote(""); load();
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
    finally { setApprovalActing(false); }
  };

  // ─── Render ───────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
    </div>
  );

  if (error || !data) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      {error ?? "Data tidak ditemukan"}
    </div>
  );

  const finished    = ["DONE", "REJECTED", "CANCELLED"].includes(data.status);
  const myId        = myProfile?.id ?? null;
  const isRequester = myId !== null && myId === data.requester.id;
  const isPic       = myId !== null && data.pic !== null && myId === data.pic.id;
  const hasItRole   = myProfile?.hasAnyAppRole ?? false;

  // Estimasi: terkunci setelah approval selesai (IT_REVIEW ke atas); hanya superadmin yg bisa override
  const planningPhase = ["DRAFT", "SUBMITTED"].includes(data.status);
  const canEditEstimasi = !finished && (
    isSuperadmin ||
    (isRequester && data.status === "DRAFT") ||
    (!isRequester && !isPic && hasItRole && planningPhase)
  );

  const canCancel = isRequester && data.status === "SUBMITTED";
  // Tolak hanya di step awal oleh PIC/superadmin, tidak di UAT/UAT_REVISION
  const canReject = (isPic || isSuperadmin) &&
    ["SUBMITTED", "IT_REVIEW", "APPROVED_IT", "APPROVED_USER", "IN_PROGRESS"].includes(data.status);
  // Cek apakah user adalah approver di chain request ini (sudah act atau eligible di step manapun)
  const isApproverInChain = (() => {
    if (!myProfile || !data.approvalRequest) return false;
    return data.approvalRequest.steps.some((s) => {
      if (s.actorId === myId) return true;
      if (s.jobPositionId && s.jobPositionId !== myProfile.jobPositionId) return false;
      if (s.organizationId && s.organizationId !== myProfile.organizationId) return false;
      if (s.branchId && s.branchId !== myProfile.branchId) return false;
      return true;
    });
  })();
  const canAssignPic = (isSuperadmin || isApproverInChain || isPic) && !finished;

  const activeApprovalStep = data.approvalRequest?.steps.find(
    (s) => s.step === data.approvalRequest!.currentStep && s.status === "PENDING"
  ) ?? null;

  const canActOnApproval = (() => {
    if (!myProfile || !activeApprovalStep || !data.approvalRequest) return false;
    if (finished) return false;
    if (data.approvalRequest.status !== "PENDING") return false;
    if (myId === data.requester.id) return false;
    if (activeApprovalStep.jobPositionId && activeApprovalStep.jobPositionId !== myProfile.jobPositionId) return false;
    if (activeApprovalStep.organizationId && activeApprovalStep.organizationId !== myProfile.organizationId) return false;
    if (activeApprovalStep.branchId && activeApprovalStep.branchId !== myProfile.branchId) return false;
    return true;
  })();

  const attachByCategory = (cat: string) => data.attachments.filter((a) => a.category === cat);
  const isOverdue = !finished && !!data.estimatedCompletedAt && new Date(data.estimatedCompletedAt) < new Date();

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[90] max-w-xs">
          <div className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.variant === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.message}
          </div>
        </div>
      )}

      <button onClick={() => router.push(`/apps/${appSlug}/requests`)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Semua Pengajuan
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400">{data.requestNo}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[data.status] ?? "bg-slate-100 text-slate-600"}`}>
                {STATUS_LABEL[data.status] ?? data.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {data.type === "NEW_APP" ? "Aplikasi Baru" : "Perubahan"}
              </span>
              {isOverdue && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> TERLAMBAT
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-800 mt-1">{data.title}</h1>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Requester: Submit */}
          {isRequester && data.status === "DRAFT" && (
            <Button onClick={handleSubmit} className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Submit
            </Button>
          )}
          {/* Requester: Approve IT Doc */}
          {isRequester && data.status === "APPROVED_IT" && (
            <Button onClick={() => setApproveDocOpen(true)} className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4" /> Setujui Dokumen
            </Button>
          )}
          {/* Requester: Finish UAT */}
          {isRequester && ["UAT", "UAT_REVISION"].includes(data.status) && (
            <Button onClick={() => setUatApproveOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCheck className="w-4 h-4" /> Selesai UAT
            </Button>
          )}

          {/* Assign PIC — setelah approval selesai (IT_REVIEW), belum ada PIC */}
          {canAssignPic && (
            <Button onClick={() => setPicOpen(true)} variant="outline" className="flex items-center gap-2">
              <User className="w-4 h-4" /> {data.pic ? "Ganti PIC" : "Assign PIC"}
            </Button>
          )}

          {/* PIC: IT Doc */}
          {isPic && data.status === "IT_REVIEW" && (
            <Button onClick={() => { setItDocContent(data.itDocument?.content ?? ""); setItDocOpen(true); }} className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Buat Dokumen IT
            </Button>
          )}
          {isPic && data.status === "APPROVED_IT" && (
            <Button variant="outline" onClick={() => { setItDocContent(data.itDocument?.content ?? ""); setItDocOpen(true); }} className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit Dokumen IT
            </Button>
          )}
          {isPic && ["APPROVED_USER", "IN_PROGRESS"].includes(data.status) && (
            <Button variant="outline" onClick={() => setProgressOpen(true)} className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Update Progress
            </Button>
          )}
          {isPic && ["APPROVED_USER", "IN_PROGRESS"].includes(data.status) && (
            <Button variant="outline" onClick={() => setEnvOpen(true)} className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> Tambah Env
            </Button>
          )}
          {(isPic || isSuperadmin) && data.status === "UAT_REVISION" && (
            <Button
              disabled={transitioning}
              onClick={async () => {
                setTransitioning(true);
                try { await patchStatus("IN_PROGRESS", "Revisi diterima, kembali ke development"); load(); }
                catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Gagal"); }
                finally { setTransitioning(false); }
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Kerjakan Revisi
            </Button>
          )}
          {(isPic || isSuperadmin) && data.status === "IN_PROGRESS" && (
            <Button onClick={() => setUatOpen(true)} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> UAT Ready
            </Button>
          )}
          {/* Requester: Perlu Revisi di UAT → kirim balik ke PIC untuk revisi */}
          {isRequester && data.status === "UAT" && (
            <Button variant="outline" onClick={() => setUatRevOpen(true)} className="flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
              <ChevronRight className="w-4 h-4" /> Perlu Revisi
            </Button>
          )}

          {/* Requester: Cancel */}
          {canCancel && (
            <Button variant="outline" onClick={() => setCancelOpen(true)} className="flex items-center gap-2 text-slate-600 border-slate-200">
              <X className="w-4 h-4" /> Batalkan
            </Button>
          )}
          {/* PIC/superadmin: Reject */}
          {canReject && (
            <Button variant="outline" onClick={() => setRejectOpen(true)} className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="w-4 h-4" /> Tolak
            </Button>
          )}

          {/* Superadmin: soft delete */}
          {isSuperadmin && (
            <Button variant="outline" onClick={() => setDeleteOpen(true)} className="flex items-center gap-2 text-red-500 border-red-100 hover:bg-red-50 p-2">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Approval block */}
          {data.approvalRequest && (
            <div className={`bg-white rounded-xl border p-5 ${
              data.approvalRequest.status === "PENDING" ? "border-amber-200" :
              data.approvalRequest.status === "APPROVED" ? "border-emerald-200" : "border-red-200"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  data.approvalRequest.status === "PENDING" ? "bg-amber-50" :
                  data.approvalRequest.status === "APPROVED" ? "bg-emerald-50" : "bg-red-50"
                }`}>
                  <Clock className={`w-4 h-4 ${
                    data.approvalRequest.status === "PENDING" ? "text-amber-600" :
                    data.approvalRequest.status === "APPROVED" ? "text-emerald-600" : "text-red-600"
                  }`} />
                </div>
                <h2 className="text-sm font-semibold text-slate-700">Alur Approval</h2>
                <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  data.approvalRequest.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" :
                  data.approvalRequest.status === "REJECTED" ? "bg-red-50 text-red-700" :
                  "bg-amber-50 text-amber-700"
                }`}>
                  {data.approvalRequest.status === "APPROVED" ? "Semua Disetujui" :
                   data.approvalRequest.status === "REJECTED" ? "Ditolak" :
                   `Step ${data.approvalRequest.currentStep} / ${data.approvalRequest.steps.length}`}
                </span>
              </div>

              {data.approvalRequest.status === "PENDING" && activeApprovalStep && (
                <div className="mb-4 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <span className="font-semibold">Menunggu: </span>{activeApprovalStep.label}
                    {activeApprovalStep.jobPositionName && <span> · <span className="font-medium">{activeApprovalStep.jobPositionName}</span></span>}
                    {activeApprovalStep.organizationName && <span> dari <span className="font-medium">{activeApprovalStep.organizationName}</span></span>}
                    {activeApprovalStep.branchName && <span> – {activeApprovalStep.branchName}</span>}
                    {canActOnApproval && <span className="ml-2 font-bold text-amber-900">(Anda yang ditunggu)</span>}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {data.approvalRequest.steps.map((s) => {
                  const isCurrentActive = s.step === data.approvalRequest!.currentStep && s.status === "PENDING";
                  return (
                    <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      isCurrentActive ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                    }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                        s.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                        s.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        isCurrentActive ? "bg-amber-200 text-amber-800" : "bg-slate-200 text-slate-500"
                      }`}>
                        {s.status === "APPROVED" ? <CheckCircle2 className="w-4 h-4" /> :
                         s.status === "REJECTED" ? <XCircle className="w-4 h-4" /> : s.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{s.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[s.jobPositionName, s.organizationName, s.branchName].filter(Boolean).join(" · ")}
                        </p>
                        {s.actorId && s.actor && (
                          <p className="text-xs text-slate-500 mt-1">
                            {s.status === "APPROVED" ? "✓" : "✗"} {s.actor.name}
                            {s.actedAt && ` · ${new Date(s.actedAt).toLocaleDateString("id-ID")}`}
                          </p>
                        )}
                        {s.note && <p className="text-xs text-slate-400 italic mt-0.5">&ldquo;{s.note}&rdquo;</p>}
                        {!s.actorId && isCurrentActive && <p className="text-xs text-amber-600 font-medium mt-1">Menunggu tindakan...</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {canActOnApproval && (
                <div className="mt-4 pt-4 border-t border-amber-100 flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => openApprovalAct("REJECTED")} className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 text-xs">
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </Button>
                  <Button onClick={() => openApprovalAct("APPROVED")} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Setujui Step Ini
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Detail info + REQUEST attachments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Informasi Pengajuan</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <InfoItem label="Diajukan oleh" value={data.requester.name ?? "-"} sub={data.requester.jobPositionName} />
              <InfoItem label="Departemen" value={data.requester.organizationName ?? "-"} />
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">IT PIC</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-semibold text-slate-700">{data.pic?.name ?? "Belum ditentukan"}</p>
                  {canAssignPic && (
                    <button onClick={() => setPicOpen(true)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors">
                      {data.pic ? "Ganti" : "Assign"}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Target Selesai</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-sm font-semibold ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                    {data.estimatedCompletedAt
                      ? new Date(data.estimatedCompletedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                      : "Belum ditentukan"}
                  </p>
                  {canEditEstimasi && (
                    <button onClick={openEstimasi} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors">
                      {data.estimatedCompletedAt ? "Ubah" : "Set"}
                    </button>
                  )}
                </div>
              </div>
              {data.refApp && <InfoItem label="Aplikasi" value={data.refApp.name} />}
              <InfoItem label="Dibuat" value={new Date(data.createdAt).toLocaleDateString("id-ID")} />
            </div>
            <div className="mb-4">
              <p className={labelCls}>Deskripsi Kebutuhan</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.description}</p>
            </div>
            {/* Attachments REQUEST */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className={labelCls + " mb-0"}>Lampiran Pengajuan</p>
                {(isRequester || isSuperadmin) && !finished && <AttachUploader requestId={id} category="REQUEST" onDone={load} />}
              </div>
              <AttachList items={attachByCategory("REQUEST")} />
              {attachByCategory("REQUEST").length === 0 && <p className="text-xs text-slate-400">Belum ada lampiran</p>}
            </div>
          </div>

          {/* IT Document + IT_DOC attachments */}
          {data.itDocument && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">Dokumen IT</h2>
                {data.itDocument.approvedAt ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui oleh {data.itDocument.approver?.name}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">Menunggu persetujuan</span>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.itDocument.content}</p>
              <p className="text-xs text-slate-400 mt-3">
                Dibuat oleh {data.itDocument.creator.name} · {new Date(data.itDocument.createdAt).toLocaleDateString("id-ID")}
              </p>
              {/* IT_DOC attachments */}
              <div className="border-t border-slate-100 mt-3 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className={labelCls + " mb-0"}>Lampiran Dokumen IT</p>
                  {(isPic || isSuperadmin) && !finished && <AttachUploader requestId={id} category="IT_DOC" onDone={load} />}
                </div>
                <AttachList items={attachByCategory("IT_DOC")} />
                {attachByCategory("IT_DOC").length === 0 && <p className="text-xs text-slate-400">Belum ada lampiran</p>}
              </div>
            </div>
          )}

          {/* Progress + PROGRESS attachments */}
          {data.progresses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Progress Pengembangan</h2>
              <div className="space-y-2">
                {data.progresses.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    {p.status === "DONE"
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      : <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                    }
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${p.status === "DONE" ? "text-emerald-700 line-through" : "text-slate-700"}`}>{p.label}</span>
                      {p.note && <p className="text-xs text-slate-400 mt-0.5">{p.note}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "DONE" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {p.status === "DONE" ? "Selesai" : "Berjalan"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 mt-4 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className={labelCls + " mb-0"}>Lampiran Progress</p>
                  {(isPic || isSuperadmin) && !finished && <AttachUploader requestId={id} category="PROGRESS" onDone={load} />}
                </div>
                <AttachList items={attachByCategory("PROGRESS")} />
                {attachByCategory("PROGRESS").length === 0 && <p className="text-xs text-slate-400">Belum ada lampiran</p>}
              </div>
            </div>
          )}

          {/* Environments */}
          {data.environments.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Environment Testing</h2>
              <div className="space-y-3">
                {data.environments.map((e) => (
                  <div key={e.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600">{e.name}</span>
                    </div>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{e.url}</a>
                    {(e.username || e.password) && (
                      <div className="flex gap-4 mt-1 text-xs text-slate-500">
                        {e.username && <span>User: {e.username}</span>}
                        {e.password && <span>Pass: {e.password}</span>}
                      </div>
                    )}
                    {e.note && <p className="text-xs text-slate-400 mt-1">{e.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permintaan revisi terkini — muncul saat UAT_REVISION atau IN_PROGRESS dengan revisi aktif */}
          {["UAT_REVISION", "IN_PROGRESS"].includes(data.status) && data.uatRevisions.length > 0 && (() => {
            const latest = data.uatRevisions[data.uatRevisions.length - 1];
            return (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-sm font-semibold text-orange-700">
                    Permintaan Revisi ke-{latest.iteration}
                  </span>
                  <span className="text-xs text-orange-500 ml-auto">
                    {new Date(latest.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    {" · "}{latest.creator.name}
                  </span>
                </div>
                {latest.note
                  ? <p className="text-sm text-orange-800">{latest.note}</p>
                  : <p className="text-xs text-orange-400 italic">Tidak ada catatan</p>
                }
                {latest.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {latest.attachments.map((a) => (
                      <a key={a.id} href={a.path} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-orange-700 hover:underline">
                        <Paperclip className="w-3 h-3" /> {a.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* UAT Revision history */}
          {data.uatRevisions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-slate-700">Riwayat Revisi UAT</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium">
                  {data.uatRevisions.length}x iterasi
                </span>
              </div>
              <div className="space-y-4">
                {data.uatRevisions.map((rev) => (
                  <div key={rev.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                        Revisi ke-{rev.iteration}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(rev.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}{rev.creator.name}
                      </span>
                    </div>
                    {rev.note && <p className="text-sm text-slate-600 mt-1">{rev.note}</p>}
                    {rev.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {rev.attachments.map((a) => (
                          <a key={a.id} href={a.path} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                            <Paperclip className="w-3 h-3" />
                            {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UAT + UAT attachments */}
          {data.uat && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">UAT (User Acceptance Test)</h2>
                {data.uat.approvedAt ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">Menunggu</span>
                )}
              </div>
              {data.uat.note && <p className="text-sm text-slate-600">{data.uat.note}</p>}
              {data.uat.approver && (
                <p className="text-xs text-slate-400 mt-2">
                  Diselesaikan oleh {data.uat.approver.name} · {data.uat.approvedAt ? new Date(data.uat.approvedAt).toLocaleDateString("id-ID") : ""}
                </p>
              )}
              <div className="border-t border-slate-100 mt-3 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className={labelCls + " mb-0"}>Lampiran UAT</p>
                  {(isRequester || isPic || isSuperadmin) && !finished && <AttachUploader requestId={id} category="UAT" onDone={load} />}
                </div>
                <AttachList items={attachByCategory("UAT")} />
                {attachByCategory("UAT").length === 0 && <p className="text-xs text-slate-400">Belum ada lampiran</p>}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Activity */}
        <div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Riwayat Aktivitas</h2>
            {data.activities.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada aktivitas</p>
            ) : (
              <div className="space-y-3">
                {data.activities.map((a, i) => (
                  <div key={a.id} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      {i < data.activities.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-xs font-medium text-slate-700">{ACTION_LABEL[a.action] ?? a.action}</p>
                      {a.note && <p className="text-xs text-slate-400 mt-0.5">{a.note}</p>}
                      <p className="text-xs text-slate-300 mt-0.5">
                        {a.actor.name} · {new Date(a.createdAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}

      {/* IT Document */}
      <Modal open={itDocOpen} onClose={() => setItDocOpen(false)} title="Dokumen IT">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Tuliskan penjelasan teknis dan bisnis untuk pengajuan ini.</p>
          <div>
            <label className={labelCls}>Konten Dokumen</label>
            <textarea className={`${inputCls} resize-none`} rows={10}
              placeholder="Solusi teknis, arsitektur, estimasi waktu, impact bisnis..."
              value={itDocContent} onChange={(e) => setItDocContent(e.target.value)} />
          </div>
          <div className="border-t border-slate-100 pt-3">
            <label className={labelCls}>Lampiran</label>
            <AttachUploader requestId={id} category="IT_DOC" onDone={load} />
            <AttachList items={attachByCategory("IT_DOC")} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setItDocOpen(false)} disabled={itDocSaving}>Batal</Button>
            <Button onClick={handleSaveItDoc} disabled={itDocSaving} className="flex items-center gap-2">
              {itDocSaving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Dokumen
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve IT Doc */}
      <Modal open={approveDocOpen} onClose={() => setApproveDocOpen(false)} title="Setujui Dokumen IT">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Dengan menyetujui, tim IT akan mulai development.</p>
          <div>
            <label className={labelCls}>Catatan (opsional)</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setApproveDocOpen(false)} disabled={approving}>Batal</Button>
            <Button onClick={handleApproveDoc} disabled={approving} className="flex items-center gap-2">
              {approving && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCheck className="w-4 h-4" /> Setujui
            </Button>
          </div>
        </div>
      </Modal>

      {/* Progress */}
      <Modal open={progressOpen} onClose={() => setProgressOpen(false)} title="Update Progress">
        <div className="space-y-4">
          <div className="space-y-2">
            {stages.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <button type="button"
                  onClick={() => setStages(stages.map((st, idx) => idx === i ? { ...st, status: st.status === "DONE" ? "IN_PROGRESS" : "DONE" } : st))}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${s.status === "DONE" ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                  {s.status === "DONE" && <CheckCircle2 className="w-4 h-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{s.label}</p>
                  <input className="w-full mt-1 border border-slate-200 rounded px-2 py-1 text-xs" placeholder="Catatan"
                    value={s.note ?? ""} onChange={(e) => setStages(stages.map((st, idx) => idx === i ? { ...st, note: e.target.value } : st))} />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <label className={labelCls}>Lampiran Progress</label>
            <AttachUploader requestId={id} category="PROGRESS" onDone={load} />
            <AttachList items={attachByCategory("PROGRESS")} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setProgressOpen(false)} disabled={progressSaving}>Batal</Button>
            <Button onClick={handleSaveProgress} disabled={progressSaving} className="flex items-center gap-2">
              {progressSaving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Environment */}
      <Modal open={envOpen} onClose={() => setEnvOpen(false)} title="Tambah Environment">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Nama</label><input className={inputCls} placeholder="Staging / UAT" value={envForm.name} onChange={(e) => setEnvForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className={labelCls}>URL</label><input className={inputCls} placeholder="https://..." value={envForm.url} onChange={(e) => setEnvForm(f => ({ ...f, url: e.target.value }))} /></div>
            <div><label className={labelCls}>Username</label><input className={inputCls} placeholder="opsional" value={envForm.username} onChange={(e) => setEnvForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div><label className={labelCls}>Password</label><input className={inputCls} placeholder="opsional" value={envForm.password} onChange={(e) => setEnvForm(f => ({ ...f, password: e.target.value }))} /></div>
          </div>
          <div><label className={labelCls}>Catatan</label><textarea className={`${inputCls} resize-none`} rows={2} value={envForm.note} onChange={(e) => setEnvForm(f => ({ ...f, note: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEnvOpen(false)} disabled={envSaving}>Batal</Button>
            <Button onClick={handleAddEnv} disabled={envSaving} className="flex items-center gap-2">
              {envSaving && <Loader2 className="w-4 h-4 animate-spin" />} Tambah
            </Button>
          </div>
        </div>
      </Modal>

      {/* UAT Ready */}
      <Modal open={uatOpen} onClose={() => setUatOpen(false)} title="Tandai UAT Ready">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Tandai pengembangan selesai dan siap untuk User Acceptance Test.</p>
          <div>
            <label className={labelCls}>Catatan untuk User</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Instruksi testing, link env..." value={uatNote} onChange={(e) => setUatNote(e.target.value)} />
          </div>
          <div className="border-t border-slate-100 pt-3">
            <label className={labelCls}>Lampiran UAT</label>
            <AttachUploader requestId={id} category="UAT" onDone={load} />
            <AttachList items={attachByCategory("UAT")} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setUatOpen(false)} disabled={uatSaving}>Batal</Button>
            <Button onClick={handleMarkUat} disabled={uatSaving} className="flex items-center gap-2">
              {uatSaving && <Loader2 className="w-4 h-4 animate-spin" />} Tandai UAT Ready
            </Button>
          </div>
        </div>
      </Modal>

      {/* UAT Finish (requester) */}
      <Modal open={uatApproveOpen} onClose={() => setUatApproveOpen(false)} title="Selesaikan UAT">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Pengajuan akan ditandai <strong>SELESAI</strong>.</p>
          <div>
            <label className={labelCls}>Catatan</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Hasil testing..." value={uatApproveNote} onChange={(e) => setUatApproveNote(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setUatApproveOpen(false)} disabled={uatApproving}>Batal</Button>
            <Button onClick={handleApproveUat} disabled={uatApproving} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              {uatApproving && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCheck className="w-4 h-4" /> Selesai
            </Button>
          </div>
        </div>
      </Modal>

      {/* UAT Revision (requester) */}
      <Modal open={uatRevOpen} onClose={() => { setUatRevOpen(false); setUatRevNote(""); setUatRevFiles([]); }} title="Perlu Revisi UAT">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Jelaskan apa yang perlu diperbaiki. Status akan kembali ke <strong>Revisi UAT</strong>.</p>
          <div>
            <label className={labelCls}>Catatan revisi</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Jelaskan apa yang perlu diperbaiki..." value={uatRevNote} onChange={(e) => setUatRevNote(e.target.value)} disabled={uatRevSaving} />
          </div>
          <div>
            <label className={labelCls}>Lampiran (opsional)</label>
            <input ref={uatRevFileRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
              onChange={(e) => { const f = Array.from(e.target.files ?? []); setUatRevFiles((prev) => [...prev, ...f]); e.target.value = ""; }} />
            <button type="button" onClick={() => uatRevFileRef.current?.click()}
              className="flex items-center gap-2 text-xs text-blue-600 border border-dashed border-blue-300 rounded-md px-3 py-2 hover:bg-blue-50 transition-colors"
              disabled={uatRevSaving}>
              <Paperclip className="w-3.5 h-3.5" /> Tambah File
            </button>
            {uatRevFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uatRevFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                    <span className="truncate text-slate-700">{f.name}</span>
                    <button type="button" onClick={() => setUatRevFiles((p) => p.filter((_, j) => j !== i))} disabled={uatRevSaving}>
                      <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setUatRevOpen(false); setUatRevNote(""); setUatRevFiles([]); }} disabled={uatRevSaving}>Batal</Button>
            <Button onClick={handleUatRevision} disabled={uatRevSaving} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600">
              {uatRevSaving && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Revisi
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign PIC */}
      <Modal open={picOpen} onClose={() => setPicOpen(false)} title="Assign PIC Development">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Pilih IT PIC yang akan menangani pengembangan request ini.</p>
          <div>
            <label className={labelCls}>Cari User</label>
            <input className={inputCls} placeholder="Nama, jabatan, departemen..."
              value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2">
            {userOptions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Tidak ada user ditemukan</p>
            ) : userOptions.map((u) => (
              <button key={u.id} type="button"
                onClick={() => setSelectedPic(u.id)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  selectedPic === u.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                  {(u.name ?? "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[u.jobPositionName, u.organizationName, u.branchName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {selectedPic === u.id && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-1" />}
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPicOpen(false)} disabled={picSaving}>Batal</Button>
            <Button onClick={handleAssignPic} disabled={picSaving || !selectedPic} className="flex items-center gap-2">
              {picSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <User className="w-4 h-4" /> Assign PIC
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approval Act */}
      <Modal open={approvalActOpen} onClose={() => setApprovalActOpen(false)}
        title={approvalActAction === "APPROVED" ? "Setujui Step Approval" : "Tolak Pengajuan"}>
        <div className="space-y-4">
          {approvalActAction === "APPROVED" ? (
            <p className="text-sm text-slate-500">
              Menyetujui step <strong>{activeApprovalStep?.label}</strong>.
              {data.approvalRequest && data.approvalRequest.currentStep === data.approvalRequest.steps.length
                ? " Ini step terakhir — pengajuan masuk IT Review."
                : ` Step ${(data.approvalRequest?.currentStep ?? 0) + 1} aktif berikutnya.`}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Pengajuan akan berstatus <strong>Ditolak</strong>.</p>
          )}
          <div>
            <label className={labelCls}>{approvalActAction === "APPROVED" ? "Catatan (opsional)" : "Alasan penolakan"}</label>
            <textarea className={`${inputCls} resize-none`} rows={3}
              placeholder={approvalActAction === "APPROVED" ? "Tambahkan catatan..." : "Jelaskan alasan..."}
              value={approvalActNote} onChange={(e) => setApprovalActNote(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setApprovalActOpen(false)} disabled={approvalActing}>Batal</Button>
            <Button onClick={handleApprovalAct}
              disabled={approvalActing || (approvalActAction === "REJECTED" && !approvalActNote.trim())}
              className={`flex items-center gap-2 ${approvalActAction === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
              {approvalActing && <Loader2 className="w-4 h-4 animate-spin" />}
              {approvalActAction === "APPROVED" ? <><CheckCircle2 className="w-4 h-4" /> Setujui</> : <><XCircle className="w-4 h-4" /> Tolak</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Batalkan Pengajuan">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Pengajuan akan dibatalkan dan tidak dapat dilanjutkan kembali.</p>
          <div>
            <label className={labelCls}>Alasan pembatalan</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Alasan pembatalan..."
              value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>Kembali</Button>
            <Button onClick={handleCancel} disabled={cancelling} className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700">
              {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
              <X className="w-4 h-4" /> Batalkan Pengajuan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Tolak Pengajuan">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Alasan penolakan</label>
            <textarea className={`${inputCls} resize-none`} rows={4} placeholder="Jelaskan alasan penolakan..."
              value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>Batal</Button>
            <Button onClick={handleReject} disabled={rejecting} className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              {rejecting && <Loader2 className="w-4 h-4 animate-spin" />}
              <XCircle className="w-4 h-4" /> Tolak
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit estimasi selesai */}
      <Modal open={estimasiOpen} onClose={() => setEstimasiOpen(false)} title="Ubah Target Selesai">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Tanggal Target Selesai</label>
            <input type="date" className={inputCls} value={estimasiVal} onChange={(e) => setEstimasiVal(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEstimasiOpen(false)} disabled={estimasiSaving}>Batal</Button>
            <Button onClick={handleSaveEstimasi} disabled={estimasiSaving} className="flex items-center gap-2">
              {estimasiSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Calendar className="w-4 h-4" /> Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete (superadmin) */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Hapus Pengajuan">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Yakin ingin menghapus pengajuan <strong>{data.requestNo}</strong>? Data tidak akan hilang permanen (soft delete).
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Batal</Button>
            <Button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              <Trash2 className="w-4 h-4" /> Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ label, value, sub, highlight }: { label: string; value: string; sub?: string | null; highlight?: "red" }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight === "red" ? "text-red-600" : "text-slate-700"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
