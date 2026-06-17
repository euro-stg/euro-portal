"use client";

import { useEffect, useRef, useState } from "react";

import { Table } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import { RefreshCw, Users, CloudDownload, UserCheck, List, Layers, X } from "lucide-react";

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
};

type UserDetail = UserRow & {
  status: string | null;
  organizationId: string | null;
  jobPositionId: string | null;
  branchId: string | null;
  image: string | null;
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
  newPassword: string;
};

type FilterState = {
  employeeId: string;
  name: string;
  status: string;
  role: string;
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

  const emptyForm: FormState = {
    id: "", employeeId: "", name: "", status: "", joinDate: "", resignDate: "",
    organizationId: "", organizationName: "", jobPositionId: "", jobPositionName: "",
    branchId: "", branchName: "", age: "", role: "", roles: [], image: null,
    phone: "", mobilePhone: "", email: "", newPassword: "",
  };

  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<FilterState>({
    employeeId: "", name: "", status: "", role: "", organizationName: "",
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
    if (f.role.trim())             p.set("role", f.role.trim());
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
  }, [filters.name, filters.employeeId, filters.status, filters.role,
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
    if (!form.role.trim()) return "Role wajib dipilih";
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
        phone: d.phone ?? "", mobilePhone: d.mobilePhone ?? "", email: d.email ?? "", newPassword: "",
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
      const payload: Record<string, unknown> = { role: form.role.trim() };
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

  const handleSyncTalenta = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/talenta/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Sync gagal"); return; }
      showToast("success", `Sync berhasil — Dibuat: ${json.created}, Diperbarui: ${json.updated}`);
      await refreshList(currentPage, filters, showAll);
    } catch (err) {
      console.error(err);
      showToast("error", "Network error");
    } finally {
      setLoading(false);
    }
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
          <Button variant="success" size="sm" onClick={handleSyncTalenta} disabled={loading}>
            <CloudDownload className="w-3.5 h-3.5" />
            Sync Talenta
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
              {["No","Employee ID","Name","Join Date","Resign Date","Organization","Branch","Position","Age","Role",""].map((h, i) => (
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
                <select className={selectSmCls} value={filters.role} onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value }))}>
                  <option value="">Semua</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={12} className="text-center py-12 text-slate-400 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Memuat data...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-12 text-slate-400 text-sm">Tidak ada data</td>
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
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button variant="primary" size="sm" onClick={() => void openDetail(item.id)}>Detail</Button>
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Data Talenta (read-only)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Employee ID">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.employeeId} />
                </FormField>
                <FormField label="Name">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.name} />
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
                <FormField label="Age">
                  <input className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`} readOnly value={form.age} />
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
              </div>
            </div>

            {/* Field yang bisa diubah */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Dapat Diubah</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Role Portal">
                  <select className={selectCls} value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                    <option value="">— Tanpa role —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
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
                    const isRemoving = removingAppId === r.appId;
                    return (
                      <div key={r.appId ?? "portal"} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <span className="font-medium text-slate-700 capitalize">{r.name}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400">{scopeLabel}</span>
                        <button
                          onClick={() => void handleRemoveRole(form.id, r.appId)}
                          disabled={isRemoving}
                          className="ml-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Hapus role ini"
                        >
                          {isRemoving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
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
    </div>
  );
}
