"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setAlert({ variant: "error", message: "Link tidak valid" });
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setAlert({ variant: "error", message: "Password dan konfirmasi tidak cocok" });
      return;
    }

    setLoading(true);
    setAlert(null);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setAlert({ variant: "error", message: data.message });
      return;
    }

    setAlert({ variant: "success", message: "Password berhasil diubah! Mengalihkan ke login..." });
    setTimeout(() => router.push("/sign-in"), 2500);
  }

  return (
    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200">
          <Layers className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          Euro<span className="text-blue-600">Portal</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">Buat Password Baru</p>
      </div>

      {alert && (
        <div className="mb-4">
          <Alert variant={alert.variant} message={alert.message} />
        </div>
      )}

      {token ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password Baru
            </label>
            <Input
              name="password"
              type="password"
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              className="border-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Konfirmasi Password
            </label>
            <Input
              name="confirm"
              type="password"
              placeholder="Ulangi password baru"
              required
              minLength={8}
              className="border-slate-200"
            />
          </div>
          <Button variant="primary" className="w-full mt-2" type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Password Baru"}
          </Button>
        </form>
      ) : (
        <div className="text-center">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Minta link reset baru
          </Link>
        </div>
      )}

      <div className="text-center mt-6">
        <Link href="/sign-in" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          ← Kembali ke halaman login
        </Link>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        © {new Date().getFullYear()} Euromedica Group
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
