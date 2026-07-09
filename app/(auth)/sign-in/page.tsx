"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

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
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background image */}
      <Image
        src="/bg-esc.jpg"
        alt=""
        fill
        className="object-cover"
        priority
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-950/30 backdrop-blur-[1px]" />

      <div className="relative z-10 w-full max-w-sm bg-white/95 rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 backdrop-blur-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-60 h-30 relative mx-auto mb-4">
            <Image src="/euromedica-logo.png" alt="Euromedica" fill className="object-contain" />
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

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Pertama kali masuk?</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        <Link
          href="/forgot-password?mode=activate"
          className="flex items-center justify-center w-full py-2.5 px-4 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors"
        >
          Aktivasi Akun
        </Link>

        <p className="text-center text-xs text-slate-400 mt-5">
          © {new Date().getFullYear()} Euromedica Group
        </p>
      </div>
    </div>
  );
}
