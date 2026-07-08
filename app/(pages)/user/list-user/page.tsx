"use client";

import { useEffect, useRef, useState } from "react";

import { Table } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import Image from "next/image";
import { RefreshCw, Users, CloudDownload, UserCheck, List, Layers, X, History, CheckCircle, AlertCircle, Clock, UserPlus, Trash2 } from "lucide-react";

type RoleEntry = { name: string; appId: string | null };

type UserRow = {
  id: string;
  employeeId: string | null;
  name: string | null;
  joinDate: string | null;
  resignDate: string | null;
  organizationName: string | null;
  branchName: string | null;
  jobPositionName: string | null;
  role: string | null;
  roles: RoleEntry[];
  age: number | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  source: string;
};

type UserDetail = UserRow & {
  status: string | null;
  organizationId: string | null;
  jobPositionId: string | null;
  branchId: string | null;
  image: string | null;
  lastName: string | null;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  address: string | null;
  religion: string | null;
  bloodType: string | null;
  maritalStatus: string | null;
  identityType: string | null;
  identityNumber: string | null;
  jobLevel: string | null;
  employmentStatus: string | null;
};

type FormState = {
  id: string;
  employeeId: string;
  name: string;
  status: string;
  joinDate: string;
  resignDate: string;
  organizationId: string;
  organizationName: string;
  jobPositionId: string;
  jobPositionName: string;
  branchId: string;
  branchName: string;
  age: string;
  role: string;
  roles: RoleEntry[];
  image: string | null;
  phone: string;
  mobilePhone: string;
  email: string;
  lastName: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  address: string;
  religion: string;
  bloodType: string;
  maritalStatus: string;
  identityType: string;
  identityNumber: string;
  jobLevel: string;
  employmentStatus: string;
  newPassword: string;
};

type FilterState = {
  employeeId: string;
  name: string;
  status: string;
  roleId: string;
  organizationName: string;
  jobPositionName: string;
  branchName: string;
  age: string;
  joinDate: string;
  resignDate: string;
};

type AppOption = { id: string; name: string };
type RoleOption = { id: string; name: string };

const inputCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const inputSmCls = "w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white transition-colors";
const selectCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const selectSmCls = "w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white transition-colors";

const roleStyle: Record<string, string> = {
  admin:      "bg-blue-50 text-blue-700 border border-blue-200",
  superadmin: "bg-slate-800 text-white border border-slate-700",
  user:       "bg-slate-100 text-slate-600 border border-slate-200",
};

function RoleBadge({ role }: { role: string | null }) {
  const cls = role ? (roleStyle[role.toLowerCase()] ?? roleStyle.user) : roleStyle.user;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {role ?? "—"}
    </span>
  );
}

function RoleBadges({ roles }: { roles: RoleEntry[] }) {
  if (roles.length === 0) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => <RoleBadge key={r.appId ?? "portal"} role={r.name} />)}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "manual") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        Manual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      Talenta
    </span>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export default function ListUserPage() {
  const [data, setData] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // Show All + Checkbox
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Assign role modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRoles, setAssignRoles] = useState<RoleOption[]>([]);
  const [assignApps, setAssignApps] = useState<AppOption[]>([]);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignAppId, setAssignAppId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Avatar preview
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Create manual user
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ employeeId: "", name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync log
  type SyncLog = { id: string; type: string; trigger: string; status: string; processed: number | null; created: number | null; updated: number | null; error: string | null; startedAt: string; finishedAt: string | null };
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const emptyForm: FormState = {
    id: "", employeeId: "", name: "", status: "", joinDate: "", resignDate: "",
    organizationId: "", organizationName: "", jobPositionId: "", jobPositionName: "",
    branchId: "", branchName: "", age: "", role: "", roles: [], image: null,
    phone: "", mobilePhone: "", email: "",
    lastName: "", gender: "", birthPlace: "", birthDate: "", address: "",
    religion: "", bloodType: "", maritalStatus: "", identityType: "",
    identityNumber: "", jobLevel: "", employmentStatus: "", newPassword: "",
  };

  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<FilterState>({
    employeeId: "", name: "", status: "", roleId: "", organizationName: "",
    jobPositionName: "", branchName: "", age: "", joinDate: "", resignDate: "",
  });

  function showToast(variant: "success" | "error", message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ variant, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  const closeModal = () => {
    setModalOpen(false);
    setDetailLoading(false);
    setDetailError(null);
    setSaving(false);
    setFormError(null);
    setForm(emptyForm);
  };

  const buildQuery = (page: number, f: FilterState, all: boolean) => {
    const p = new URLSearchParams();
    if (all) { p.set("all", "true"); }
    else { p.set("page", String(page)); }
    if (f.name.trim())             p.set("name", f.name.trim());
    if (f.employeeId.trim())       p.set("employeeId", f.employeeId.trim());
    if (f.status.trim())           p.set("status", f.status.trim());
    if (f.roleId.trim())           p.set("roleId", f.roleId.trim());
    if (f.organizationName.trim()) p.set("organizationName", f.organizationName.trim());
    if (f.jobPositionName.trim())  p.set("jobPositionName", f.jobPositionName.trim());
    if (f.branchName.trim())       p.set("branchName", f.branchName.trim());
    if (f.age.trim())              p.set("age", f.age.trim());
    if (f.joinDate.trim())         p.set("joinDate", f.joinDate.trim());
    if (f.resignDate.trim())       p.set("resignDate", f.resignDate.trim());
    return p.toString();
  };

  const refreshList = async (page = currentPage, f = filters, all = showAll) => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/user/list?${buildQuery(page, f, all)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setData([]); setListError(json?.message ?? "Failed to load data"); return; }
      setData(Array.isArray(json?.data) ? json.data : []);
      setTotalPages(json?.meta?.totalPages ?? 1);
      setCurrentPage(json?.meta?.page ?? 1);
    } catch (err) {
      console.error(err);
      setData([]);
      setListError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const toggleShowAll = () => {
    const next = !showAll;
    setShowAll(next);
    setSelectedIds(new Set());
    void refreshList(1, filters, next);
  };

  useEffect(() => {
    const t = setTimeout(() => void refreshList(1, filters, false), 0);
    Promise.all([
      fetch("/api/role/list?status=active").then((r) => r.json()),
      fetch("/api/module/list?type=app").then((r) => r.json()),
    ])
      .then(([rj, aj]) => {
        setRoles(rj?.data ?? []);
        setAssignRoles(rj?.data ?? []);
        setAssignApps(aj?.data ?? []);
      })
      .catch(() => {});
    return () => { clearTimeout(t); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refreshList(1, filters, showAll), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name, filters.employeeId, filters.status, filters.roleId,
      filters.organizationName, filters.jobPositionName, filters.branchName,
      filters.age, filters.joinDate, filters.resignDate]);

  const handlePageChange = (page: number) => { setCurrentPage(page); void refreshList(page, filters, showAll); };

  // Checkbox helpers
  const isAllSelected = data.length > 0 && data.every((u) => selectedIds.has(u.id));
  const isSomeSelected = data.some((u) => selectedIds.has(u.id)) && !isAllSelected;
  const selectedCount = selectedIds.size;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        data.forEach((u) => next.delete(u.id));
      } else {
        data.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Bulk assign role
  const openAssign = () => {
    setAssignRoleId("");
    setAssignAppId(null);
    setAssignError(null);
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignRoleId) { setAssignError("Pilih role terlebih dahulu"); return; }
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch("/api/user/bulk-assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          roleId: assignRoleId,
          appId: assignAppId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setAssignError(json?.message ?? "Gagal assign role"); return; }
      showToast("success", json?.message ?? "Role berhasil di-assign");
      setAssignOpen(false);
      clearSelection();
      void refreshList(currentPage, filters, showAll);
    } catch { setAssignError("Network error"); }
    finally { setAssigning(false); }
  };

  const validateForm = (): string | null => {
    return null;
  };

  const openDetail = async (id: string) => {
    setModalOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setFormError(null);
    try {
      const res = await fetch(`/api/user/detail/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { const msg = json?.message ?? "Gagal memuat detail"; setDetailError(msg); showToast("error", msg); return; }
      const d: UserDetail | null = json?.data ?? null;
      if (!d) { setDetailError("Data tidak ditemukan"); return; }
      setForm({
        id: d.id, name: d.name ?? "", employeeId: d.employeeId ?? "",
        status: d.status ?? "", joinDate: d.joinDate ? d.joinDate.slice(0, 10) : "",
        resignDate: d.resignDate ? d.resignDate.slice(0, 10) : "",
        organizationId: d.organizationId ?? "", organizationName: d.organizationName ?? "",
        jobPositionId: d.jobPositionId ?? "", jobPositionName: d.jobPositionName ?? "",
        branchId: d.branchId ?? "", branchName: d.branchName ?? "",
        age: d.age != null ? String(d.age) : "", role: d.role?.toLowerCase() ?? "",
        roles: d.roles ?? [], image: d.image ?? null,
        phone: d.phone ?? "", mobilePhone: d.mobilePhone ?? "", email: d.email ?? "",
        lastName: d.lastName ?? "", gender: d.gender ?? "", birthPlace: d.birthPlace ?? "",
        birthDate: d.birthDate ? d.birthDate.slice(0, 10) : "", address: d.address ?? "",
        religion: d.religion ?? "", bloodType: d.bloodType ?? "", maritalStatus: d.maritalStatus ?? "",
        identityType: d.identityType ?? "", identityNumber: d.identityNumber ?? "",
        jobLevel: d.jobLevel ?? "", employmentStatus: d.employmentStatus ?? "", newPassword: "",
      });
    } catch (err) {
      console.error(err);
      setDetailError("Network error");
      showToast("error", "Network error");
    } finally {
      setDetailLoading(false);
    }
  };

  const [removingAppId, setRemovingAppId] = useState<string | null | undefined>(undefined);

  const handleRemoveRole = async (userId: string, appId: string | null) => {
    setRemovingAppId(appId);
    try {
      const res = await fetch("/api/user/remove-role", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, appId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { showToast("error", json?.message ?? "Gagal hapus role"); return; }
      showToast("success", "Role dihapus");
      // Refresh roles list in modal and main list
      setForm((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.appId !== appId), role: appId === null ? "" : prev.role }));
      void refreshList(currentPage, filters, showAll);
    } catch { showToast("error", "Network error"); }
    finally { setRemovingAppId(undefined); }
  };

  const handleUpdate = async () => {
    if (saving) return;
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (form.newPassword.trim()) payload.password = form.newPassword.trim();

      const res = await fetch(`/api/user/update/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { const msg = json?.message ?? "Update gagal"; setFormError(msg); showToast("error", msg); return; }
      showToast("success", json?.message ?? "Update berhasil");
      closeModal();
      void refreshList(currentPage, filters, showAll);
    } catch (err) {
      console.error(err);
      setFormError("Network error");
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  };

  const fetchSyncLogs = async () => {
    const res = await fetch("/api/talenta/sync-logs?type=user");
    if (res.ok) { const json = await res.json(); setSyncLogs(json.data ?? []); }
  };

  const handleSyncTalenta = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/talenta/sync", {
        method: "POST",
        signal: AbortSignal.timeout(5 * 60 * 1000), // 5 menit
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Sync gagal"); return; }
      showToast("success", `Sync berhasil — Dibuat: ${json.created}, Diperbarui: ${json.updated}`);
      await Promise.all([refreshList(currentPage, filters, showAll), fetchSyncLogs()]);
    } catch (err) {
      console.error(err);
      showToast("error", "Network error");
    } finally {
      setLoading(false);
    }
  };

  const openSyncLog = async () => {
    await fetchSyncLogs();
    setLogOpen(true);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setCreateError(json?.message ?? "Gagal membuat user"); return; }
      showToast("success", "User berhasil dibuat");
      setCreateOpen(false);
      setCreateForm({ employeeId: "", name: "", email: "", password: "" });
      void refreshList(currentPage, filters, showAll);
    } catch { setCreateError("Network error"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Nonaktifkan user ini?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/user/delete/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { showToast("error", json?.message ?? "Gagal menghapus user"); return; }
      showToast("success", "User dinonaktifkan");
      void refreshList(currentPage, filters, showAll);
    } catch { showToast("error", "Network error"); }
    finally { setDeletingId(null); }
  };

  // Roles filtered by selected scope for assign modal
  const filteredAssignRoles = assignRoles.filter((r) => {
    // This filters by appId on the role itself — roles API doesn't return appId here
    // so just show all for now; bulk-assign-role API validates on backend
    return true;
  });

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">User List</h1>
            <p className="text-slate-400 text-xs">Manajemen data pengguna</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshList(currentPage, filters, showAll)} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <button
            onClick={toggleShowAll}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              showAll
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showAll ? <Layers className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            {showAll ? "Per Halaman" : "Tampilkan Semua"}
          </button>
          <Link href="/user/bulk-assign">
            <Button variant="outline" size="sm">
              <UserCheck className="w-3.5 h-3.5" />
              Bulk Assign Role
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => { setCreateError(null); setCreateOpen(true); }}>
            <UserPlus className="w-3.5 h-3.5" />
            Tambah User
          </Button>
          <Button variant="success" size="sm" onClick={handleSyncTalenta} disabled={loading}>
            <CloudDownload className="w-3.5 h-3.5" />
            Sync Talenta
          </Button>
          <Button variant="secondary" size="sm" onClick={openSyncLog}>
            <History className="w-3.5 h-3.5" />
            Log Sync
          </Button>
        </div>
      </div>

      {listError && <div className="mb-4"><Alert variant="error" message={listError} /></div>}

      {/* Selection action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-medium text-blue-800">
            {selectedCount} user dipilih
          </span>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="sm"
            onClick={openAssign}
            className="flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assign Role
          </Button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Batal pilih
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                />
              </th>
              {["No","Employee ID","Name","Join Date","Resign Date","Organization","Branch","Position","Age","Role","Source",""].map((h, i) => (
                <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-100 bg-white">
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2"><input className={inputSmCls} placeholder="Cari..." value={filters.employeeId} onChange={(e) => setFilters((p) => ({ ...p, employeeId: e.target.value }))} /></td>
              <td className="px-3 py-2"><input className={inputSmCls} placeholder="Cari..." value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))} /></td>
              <td className="px-3 py-2"><input type="date" className={inputSmCls} value={filters.joinDate} onChange={(e) => setFilters((p) => ({ ...p, joinDate: e.target.value }))} /></td>
              <td className="px-3 py-2"><input type="date" className={inputSmCls} value={filters.resignDate} onChange={(e) => setFilters((p) => ({ ...p, resignDate: e.target.value }))} /></td>
              <td className="px-3 py-2"><input className={inputSmCls} placeholder="Cari..." value={filters.organizationName} onChange={(e) => setFilters((p) => ({ ...p, organizationName: e.target.value }))} /></td>
              <td className="px-3 py-2"><input className={inputSmCls} placeholder="Cari..." value={filters.branchName} onChange={(e) => setFilters((p) => ({ ...p, branchName: e.target.value }))} /></td>
              <td className="px-3 py-2"><input className={inputSmCls} placeholder="Cari..." value={filters.jobPositionName} onChange={(e) => setFilters((p) => ({ ...p, jobPositionName: e.target.value }))} /></td>
              <td className="px-3 py-2"><input className={inputSmCls} placeholder="e.g. 25" value={filters.age} onChange={(e) => setFilters((p) => ({ ...p, age: e.target.value }))} /></td>
              <td className="px-3 py-2">
                <select className={selectSmCls} value={filters.roleId} onChange={(e) => setFilters((p) => ({ ...p, roleId: e.target.value }))}>
                  <option value="">Semua</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Memuat data...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-12 text-slate-400 text-sm">Tidak ada data</td>
              </tr>
            ) : (
              data.map((item, index) => {
                const checked = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    onClick={() => toggleRow(item.id)}
                    className={`cursor-pointer transition-colors ${checked ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-slate-50/60"}`}
                  >
                    <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(item.id)}
                        className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                      />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 w-10">{(currentPage - 1) * 10 + index + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{item.employeeId ?? "—"}</td>
                    <td className="px-3 py-3 text-sm font-medium text-slate-800">{item.name ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(item.joinDate)}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(item.resignDate)}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{item.organizationName ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{item.branchName ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{item.jobPositionName ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 text-center">{item.age ?? "—"}</td>
                    <td className="px-3 py-3"><RoleBadges roles={item.roles ?? (item.role ? [{ name: item.role, appId: null }] : [])} /></td>
                    <td className="px-3 py-3"><SourceBadge source={item.source ?? "talenta"} /></td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Button variant="primary" size="sm" onClick={() => void openDetail(item.id)}>Detail</Button>
                        {item.source === "manual" && (
                          <button
                            onClick={() => void handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            {deletingId === item.id ? "..." : "Hapus"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      {!showAll && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
      {showAll && data.length > 0 && (
        <p className="text-xs text-slate-400 mt-3 text-center">{data.length} user ditampilkan</p>
      )}

      {/* Assign Role Modal */}
      <Modal open={assignOpen} title={`Assign Role — ${selectedCount} user dipilih`} onClose={() => setAssignOpen(false)} boxClassName="w-full max-w-md">
        <div className="space-y-4">
          {assignError && <Alert variant="error" message={assignError} />}
          <FormField label="Scope">
            <select
              className={selectCls}
              value={assignAppId ?? "null"}
              onChange={(e) => setAssignAppId(e.target.value === "null" ? null : e.target.value)}
            >
              <option value="null">Portal</option>
              {assignApps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Role">
            <select className={selectCls} value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}>
              <option value="" disabled>Pilih role...</option>
              {filteredAssignRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </FormField>
          <p className="text-xs text-slate-400">
            Role akan di-assign ke <strong>{selectedCount} user</strong> pada scope <strong>{assignAppId === null ? "Portal" : (assignApps.find((a) => a.id === assignAppId)?.name ?? assignAppId)}</strong>.
            Role lama pada scope yang sama akan digantikan.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setAssignOpen(false)} disabled={assigning}>Batal</Button>
            <Button variant="primary" onClick={handleAssign} disabled={assigning || !assignRoleId}>
              {assigning ? "Menyimpan..." : "Assign Role"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail / Update Modal */}
      <Modal open={modalOpen} title="Detail User" onClose={closeModal} boxClassName="w-11/12 max-w-2xl">
        {detailLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : detailError ? (
          <Alert variant="error" message={detailError} />
        ) : (
          <div className="space-y-5">
            {formError && <Alert variant="error" message={formError} />}

            {/* Info dari Talenta — readonly */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Data Talenta (read-only)</p>

              {/* Avatar */}
              {form.image && (
                <div className="flex justify-center mb-4">
                  <button type="button" onClick={() => setAvatarPreview(form.image)} className="group relative w-20 h-20 rounded-full overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-colors">
                    <Image src={form.image} alt={form.name} fill className="object-cover" unoptimized />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Lihat</span>
                    </div>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Employee ID">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.employeeId} />
                </FormField>
                <FormField label="Nama Depan">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.name} />
                </FormField>
                <FormField label="Nama Belakang">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.lastName} />
                </FormField>
                <FormField label="Gender">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.gender} />
                </FormField>
                <FormField label="Tempat Lahir">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.birthPlace} />
                </FormField>
                <FormField label="Tanggal Lahir">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.birthDate} />
                </FormField>
                <FormField label="Agama">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.religion} />
                </FormField>
                <FormField label="Status Pernikahan">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.maritalStatus} />
                </FormField>
                <FormField label="Golongan Darah">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.bloodType} />
                </FormField>
                <FormField label="Jenis Identitas">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.identityType} />
                </FormField>
                <FormField label="Nomor Identitas">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.identityNumber} />
                </FormField>
                <FormField label="Organization">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.organizationName} />
                </FormField>
                <FormField label="Branch">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.branchName} />
                </FormField>
                <FormField label="Job Position">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.jobPositionName} />
                </FormField>
                <FormField label="Job Level">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.jobLevel} />
                </FormField>
                <FormField label="Status Kepegawaian">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.employmentStatus} />
                </FormField>
                <FormField label="Join Date">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.joinDate} />
                </FormField>
                <FormField label="Resign Date">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.resignDate} />
                </FormField>
                <FormField label="Phone">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.phone} />
                </FormField>
                <FormField label="Mobile Phone">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.mobilePhone} />
                </FormField>
                <FormField label="Email">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.email} />
                </FormField>
                <FormField label="Status">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed capitalize`} readOnly value={form.status} />
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Alamat">
                    <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.address} />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Field yang bisa diubah */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Dapat Diubah</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Role Portal">
                  <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50">
                    {form.role ? (
                      <RoleBadge role={form.role} />
                    ) : (
                      <span className="text-xs text-slate-400 italic">Tanpa role</span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">Kelola di Bulk Assign</span>
                  </div>
                </FormField>
                <FormField label="Password Baru (kosong = tidak berubah)">
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="Isi untuk reset password..."
                    value={form.newPassword}
                    onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
                  />
                </FormField>
              </div>
            </div>

            {/* Role Terdaftar */}
            {form.roles.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Role Terdaftar</p>
                <div className="flex flex-wrap gap-2">
                  {form.roles.map((r) => {
                    const scopeLabel = r.appId === null
                      ? "Portal"
                      : (assignApps.find((a) => a.id === r.appId)?.name ?? "App");
                    return (
                      <div key={r.appId ?? "portal"} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <span className="font-medium text-slate-700 capitalize">{r.name}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400">{scopeLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" type="button" onClick={closeModal}>Batal</Button>
              <Button variant="primary" type="button" onClick={() => void handleUpdate()} disabled={saving}>
                {saving ? "Menyimpan..." : "Update"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Avatar Lightbox */}
      {avatarPreview && (
        <div className="fixed inset-0 z-[999] bg-black/70 flex items-center justify-center" onClick={() => setAvatarPreview(null)}>
          <div className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Image src={avatarPreview} alt="Avatar" fill className="object-cover" unoptimized />
          </div>
          <button type="button" onClick={() => setAvatarPreview(null)} className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Create Manual User Modal */}
      <Modal open={createOpen} title="Tambah User Manual" onClose={() => setCreateOpen(false)} boxClassName="w-full max-w-md">
        <div className="space-y-4">
          {createError && <Alert variant="error" message={createError} />}
          <FormField label="Employee ID *">
            <input
              className={inputCls}
              placeholder="Contoh: EXT001"
              value={createForm.employeeId}
              onChange={(e) => setCreateForm((p) => ({ ...p, employeeId: e.target.value }))}
            />
          </FormField>
          <FormField label="Nama *">
            <input
              className={inputCls}
              placeholder="Nama lengkap"
              value={createForm.name}
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              className={inputCls}
              placeholder="email@example.com (opsional)"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
          </FormField>
          <FormField label="Password *">
            <input
              type="password"
              className={inputCls}
              placeholder="Minimal 8 karakter"
              value={createForm.password}
              onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Batal</Button>
            <Button variant="primary" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? "Menyimpan..." : "Buat User"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sync Log Modal */}
      <Modal open={logOpen} title="Log Sync User" onClose={() => setLogOpen(false)} boxClassName="w-11/12 max-w-2xl">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {syncLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada log sync user.</p>
          ) : syncLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div className="mt-0.5 shrink-0">
                {log.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {log.status === "error"   && <AlertCircle className="w-4 h-4 text-red-500" />}
                {log.status === "running" && <Clock className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.trigger === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                    {log.trigger}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(log.startedAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {log.finishedAt && (
                    <span className="text-xs text-slate-400">
                      ({Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}d)
                    </span>
                  )}
                </div>
                {log.status === "success" && (
                  <p className="text-xs text-slate-600 mt-1">
                    Processed: <b>{log.processed}</b> — Dibuat: <b>{log.created}</b> — Diperbarui: <b>{log.updated}</b>
                  </p>
                )}
                {log.status === "error" && (
                  <p className="text-xs text-red-600 mt-1 truncate">{log.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
