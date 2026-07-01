"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Layers, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const isActivate = searchParams.get("mode") === "activate";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ employeeId: string; name: string; email: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const employeeId = (new FormData(e.currentTarget).get("employeeId") as string).trim();

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message ?? "Terjadi kesalahan, coba lagi.");
      return;
    }

    setSent({ employeeId: data.employeeId, name: data.name, email: data.email });
  }

  return (
    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
      <div className="text-center mb-8">
        <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg ${
          isActivate
            ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200"
            : "bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-200"
        }`}>
          <Layers className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          Euro<span className="text-blue-600">Portal</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {isActivate ? "Aktivasi Akun" : "Lupa Password"}
        </p>
      </div>

      {!sent ? (
        <>
          {error && (
            <div className="mb-4">
              <Alert variant="error" message={error} />
            </div>
          )}

          {isActivate && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-800 leading-relaxed">
                Selamat datang! Masukkan <strong>Employee ID</strong> kamu untuk mendapatkan link aktivasi ke email terdaftar.
              </p>
            </div>
          )}

          <p className="text-slate-500 text-sm mb-5 leading-relaxed">
            {isActivate
              ? "Setelah klik link di email, kamu bisa membuat password dan langsung masuk ke portal."
              : "Masukkan Employee ID kamu. Kami akan mengirimkan link reset password ke email terdaftar."}
          </p>

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
            <Button
              variant="primary"
              className={`w-full mt-2 ${isActivate ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600" : ""}`}
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Mengirim..."
                : isActivate ? "Kirim Link Aktivasi" : "Kirim Link Reset"}
            </Button>
          </form>
        </>
      ) : (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            isActivate
              ? "bg-emerald-50 border-emerald-200"
              : "bg-green-50 border-green-200"
          }`}>
            <CheckCircle className={`w-5 h-5 shrink-0 ${isActivate ? "text-emerald-600" : "text-green-600"}`} />
            <p className={`text-sm font-medium ${isActivate ? "text-emerald-800" : "text-green-800"}`}>
              {isActivate ? "Link aktivasi berhasil dikirim!" : "Link reset berhasil dikirim!"}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">NIK</span>
              <span className="font-medium text-slate-800">{sent.employeeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Nama</span>
              <span className="font-medium text-slate-800">{sent.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800">{sent.email}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed text-center">
            {isActivate
              ? "Cek inbox atau folder spam, klik link untuk membuat password dan mengaktifkan akun kamu."
              : "Cek inbox atau folder spam email di atas, klik link untuk membuat password baru."}
          </p>
        </div>
      )}

      <div className="text-center mt-6">
        <Link href="/sign-in" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          ← Kembali ke halaman login
        </Link>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        © {new Date().getFullYear()} Euromedica Group
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
