"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthUser } from "@/hooks/useAuthUser";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const readonlyCls = "h-10 px-3 flex items-center border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-500 overflow-hidden";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Field label={label}>
      <div className={readonlyCls}><span className="truncate">{value ?? "—"}</span></div>
    </Field>
  );
}

const inputCls = "w-full h-10 border border-slate-200 rounded-md px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors disabled:opacity-60";

export default function ProfilePage() {
  const { user } = useAuthUser();

  const passwordRef        = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving]               = useState(false);
  const [alert, setAlert]                 = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 3000);
    return () => clearTimeout(t);
  }, [alert]);

  const formatDate = (iso?: string | Date | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  };

  const avatarSrc = useMemo(() => {
    const img = (user?.image ?? "").trim();
    return img || "/avatar.svg";
  }, [user?.image]);

  const isRemoteAvatar = useMemo(() => /^https?:\/\//i.test(avatarSrc), [avatarSrc]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setAlert(null);
    setPasswordError(null);

    try {
      const password        = String(passwordRef.current?.value ?? "").trim();
      const confirmPassword = String(confirmPasswordRef.current?.value ?? "").trim();

      if (!password) {
        setAlert({ variant: "error", message: "Masukkan password baru" });
        return;
      }
      if (password !== confirmPassword) { setPasswordError("Password tidak cocok"); return; }
      if (password.length < 6)          { setPasswordError("Minimal 6 karakter");    return; }

      const res  = await fetch(`/api/user/update/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) { setAlert({ variant: "error", message: json?.message ?? "Gagal memperbarui" }); return; }

      setAlert({ variant: "success", message: "Password berhasil diperbarui" });
      if (passwordRef.current)        passwordRef.current.value = "";
      if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
    } catch (e) {
      console.error(e);
      setAlert({ variant: "error", message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Profile</h1>
        <p className="text-slate-400 text-xs mt-0.5">Informasi akun Anda</p>
      </div>

      {alert && <div className="mb-4"><Alert variant={alert.variant} message={alert.message} /></div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Avatar header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 bg-slate-50">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-200 flex-shrink-0 ring-2 ring-white shadow">
            {isRemoteAvatar ? (
              <Image src={avatarSrc} alt="Avatar" fill className="object-cover" />
            ) : (
              <Image src={avatarSrc} alt="Avatar" width={64} height={64} className="object-cover" priority />
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-base">{user?.name ?? "—"}</p>
            <p className="text-sm text-slate-500 mt-0.5">{user?.employeeId ?? "—"}</p>
            {user?.status && (
              <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                user.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}>{user.status}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">

          {/* Data Talenta — read only */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Data Talenta (read-only)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadonlyField label="Employee ID"  value={user?.employeeId} />
              <ReadonlyField label="Nama"         value={user?.name} />
              <ReadonlyField label="Email"        value={user?.email} />
              <ReadonlyField label="No. Telepon"  value={user?.phone} />
              <ReadonlyField label="No. HP / WA"  value={user?.mobilePhone} />
              <ReadonlyField label="Jabatan"      value={user?.jobPositionName} />
              <ReadonlyField label="Departemen"   value={user?.organizationName} />
              <ReadonlyField label="Cabang"       value={user?.branchName} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <ReadonlyField label="Usia"              value={user?.age} />
              <ReadonlyField label="Tanggal Bergabung" value={formatDate(user?.joinDate)} />
              <ReadonlyField label="Tanggal Resign"    value={formatDate(user?.resignDate)} />
            </div>
          </div>

          {/* Sistem */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Informasi Sistem</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadonlyField label="Dibuat"      value={formatDate(user?.createdAt)} />
              <ReadonlyField label="Diperbarui"  value={formatDate(user?.updatedAt)} />
            </div>
          </div>

          {/* Ganti password */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Ganti Password</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Password Baru">
                <input ref={passwordRef} type="password" className={inputCls}
                  placeholder="Minimal 6 karakter" autoComplete="new-password" disabled={saving} />
              </Field>
              <Field label="Konfirmasi Password">
                <input ref={confirmPasswordRef} type="password" className={inputCls}
                  placeholder="Ulangi password baru" autoComplete="new-password" disabled={saving} />
              </Field>
            </div>
            {passwordError && <p className="mt-1.5 text-xs text-red-500">{passwordError}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
