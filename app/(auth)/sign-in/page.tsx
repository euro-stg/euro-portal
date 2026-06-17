"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  function showAlert(variant: "success" | "error", message: string, onFinish?: () => void) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAlert({ variant, message });
    timeoutRef.current = setTimeout(() => {
      setAlert(null);
      onFinish?.();
    }, 3000);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const formData   = new FormData(e.currentTarget);
    const employeeId = formData.get("employeeId") as string;
    const password   = formData.get("password") as string;

    const res = await signIn("credentials", { employeeId, password, redirect: false });
    setLoading(false);

    if (!res || res.error) {
      showAlert("error", "Employee ID atau password salah");
      return;
    }

    showAlert("success", "Login berhasil, mengalihkan...", () => { router.push("/"); });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Euro<span className="text-blue-600">Portal</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Portal Perusahaan Terpadu</p>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert variant={alert.variant} message={alert.message} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Employee ID
            </label>
            <Input
              name="employeeId"
              type="text"
              placeholder="Masukkan Employee ID"
              required
              className="border-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <Input
              name="password"
              type="password"
              placeholder="Masukkan Password"
              required
              className="border-slate-200"
            />
          </div>
          <Button variant="primary" className="w-full mt-2" type="submit" disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
          </Button>
        </form>

        <div className="text-center mt-5">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Lupa password?
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          © {new Date().getFullYear()} Euromedica Group
        </p>
      </div>
    </div>
  );
}
