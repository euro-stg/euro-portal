"use client";

import { useEffect, useState } from "react";
import { Copy, Check, BookOpen, Lock, Users, ShieldCheck, ArrowRight, ChevronDown, GitBranch, Briefcase, Building2 } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle} className="absolute top-3 right-3 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  return (
    <div className="relative mt-2 rounded-lg bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">{lang}</span>
      </div>
      <CopyButton text={code} />
      <pre className="p-4 text-sm text-slate-200 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{code}</pre>
    </div>
  );
}

function Badge({ method }: { method: "GET" | "POST" }) {
  const cls = method === "POST" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${cls}`}>{method}</span>;
}

function Section({ id, icon: Icon, title, children, open, onToggle }: {
  id: string; icon: React.ElementType; title: string; children: React.ReactNode;
  open: boolean; onToggle: () => void;
}) {
  return (
    <section id={id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold text-slate-800 flex-1">{title}</h2>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 py-5 space-y-5 border-t border-slate-100">{children}</div>
      )}
    </section>
  );
}

function Field({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <code className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded shrink-0">{name}</code>
      <span className="text-xs text-slate-400 shrink-0">{type}</span>
      {required && <span className="text-[10px] text-red-500 font-semibold shrink-0">wajib</span>}
      <span className="text-xs text-slate-500">{desc}</span>
    </div>
  );
}

export default function ApiDocsPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [BASE_URL, setBaseUrl] = useState("https://portal.euromedica.co.id");

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  const toggle = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">API Documentation — SSO EuroPortal</h1>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          API Single Sign-On untuk integrasi aplikasi eksternal dengan sistem autentikasi dan data pengguna EuroPortal.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full">Base URL: <code className="font-mono">{BASE_URL}</code></span>
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full">Format: JSON</span>
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full">Auth: X-App-Token header</span>
        </div>
      </div>

      {/* Auth note */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Autentikasi Apps</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Semua endpoint memerlukan header <code className="font-mono bg-amber-100 px-1 rounded">X-App-Token</code> yang berisi token apps yang telah didaftarkan oleh administrator portal.
            Hubungi admin untuk mendapatkan token.
          </p>
        </div>
      </div>

      {/* SSO Flow diagram */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Alur Utama SSO (Option A — Deep Link dari Portal)</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {[
            "User login ke portal",
            "Klik card apps",
            "Portal POST /api/sso/generate-link",
            "Redirect ke apps?sso_token=xxx",
            "Apps GET /api/sso/validate?sso_token=xxx",
            "Dapat data user + sessionToken",
            "Apps buat session sendiri",
          ].map((step, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium">{step}</span>
              {i < 6 && <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          <code className="font-mono bg-slate-200 px-1 rounded">sso_token</code> berlaku <strong>5 menit</strong>, single-use.
          Setelah dikonsumsi, apps menerima <code className="font-mono bg-slate-200 px-1 rounded">sessionToken</code> berlaku <strong>24 jam</strong> untuk request berikutnya.
        </p>
      </div>

      {/* 0. Generate Link */}
      <Section id="generate-link" icon={ShieldCheck} title="1. Generate SSO Link (Dari Portal)" open={openSections.has("generate-link")} onToggle={() => toggle("generate-link")}>
        <div className="flex items-center gap-3">
          <Badge method="POST" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/generate-link</code>
        </div>
        <p className="text-sm text-slate-600">
          Dipanggil oleh portal saat user menekan tombol/card menuju apps eksternal.
          Memerlukan <strong>session portal yang aktif</strong> (user harus sudah login di portal).
          Mengembalikan URL redirect lengkap yang siap diarahkan ke browser.
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Request Body</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="appTokenId" type="string" required desc="ID app token tujuan (dari halaman App Token di portal)" />
            <Field name="redirectUrl" type="string" required desc="URL halaman /sso di apps eksternal yang akan menerima token" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="javascript" code={`// Dipanggil dari kode portal (client-side)
const res = await fetch('/api/sso/generate-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appTokenId: 'clxyz_app_token_id',
    redirectUrl: 'https://euro-lms.com/sso',
  }),
});
const { redirectUrl } = await res.json();
window.location.href = redirectUrl;
// → redirect ke: https://euro-lms.com/sso?sso_token=abc123...`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`{
  "redirectUrl": "https://euro-lms.com/sso?sso_token=a3f8c2d1...",
  "expiresAt": "2026-06-11T10:05:00.000Z"
}`} />
        </div>
      </Section>

      {/* 1. Login */}
      <Section id="login" icon={ShieldCheck} title="2. Login API" open={openSections.has("login")} onToggle={() => toggle("login")}>
        <div className="flex items-center gap-3">
          <Badge method="POST" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/login</code>
        </div>
        <p className="text-sm text-slate-600">
          Autentikasi pengguna menggunakan Employee ID dan password. Jika berhasil, mengembalikan <strong>user token</strong> yang berlaku <strong>24 jam</strong>.
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Request Headers</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="X-App-Token" type="string" required desc="Token aplikasi yang didaftarkan di portal" />
            <Field name="Content-Type" type="string" required desc="application/json" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Request Body</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="employeeId" type="string" required desc="ID karyawan (Employee ID dari sistem Talenta)" />
            <Field name="password" type="string" required desc="Password akun portal karyawan" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="bash" code={`curl -X POST ${BASE_URL}/api/sso/login \\
  -H "Content-Type: application/json" \\
  -H "X-App-Token: your-app-token-here" \\
  -d '{
    "employeeId": "EMP001",
    "password": "password123"
  }'`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`{
  "token": "a3f8c2d1e9b4...",
  "expiresAt": "2026-06-12T10:00:00.000Z",
  "user": {
    "id": "clxyz123",
    "employeeId": "EMP001",
    "name": "Budi",
    "lastName": "Santoso",
    "email": "budi@euromedica.co.id",
    "phone": "0211234567",
    "mobilePhone": "081234567890",
    "gender": "male",
    "birthPlace": "Jakarta",
    "birthDate": "1996-03-15T00:00:00.000Z",
    "address": "Jl. Sudirman No.1, Jakarta",
    "religion": "Islam",
    "bloodType": "O",
    "maritalStatus": "single",
    "identityType": "ktp",
    "identityNumber": "3171234567890001",
    "jobPositionId": "JP001",
    "jobPositionName": "Software Engineer",
    "jobLevel": "Staff",
    "organizationId": "ORG001",
    "organizationName": "IT Department",
    "branchId": "BR001",
    "branchName": "Jakarta Pusat",
    "employmentStatus": "permanent",
    "age": 28,
    "joinDate": "2022-01-15T00:00:00.000Z",
    "resignDate": null,
    "status": "active",
    "image": "https://talenta.oss-ap-southeast-5.aliyuncs.com/..."
  }
}`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Error</p>
          <CodeBlock code={`// 401 - Kredensial salah
{ "error": "Kredensial tidak valid" }

// 401 - App token tidak valid
{ "error": "App token tidak valid atau tidak aktif" }

// 403 - Akun nonaktif
{ "error": "Akun tidak aktif" }

// 400 - Field kurang
{ "error": "employeeId dan password wajib diisi" }`} />
        </div>
      </Section>

      {/* 2. Validate */}
      <Section id="validate" icon={ShieldCheck} title="3. Validasi Token" open={openSections.has("validate")} onToggle={() => toggle("validate")}>
        <div className="flex items-center gap-3">
          <Badge method="GET" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/validate</code>
        </div>
        <p className="text-sm text-slate-600">
          Memvalidasi token dan mengembalikan data pengguna lengkap. Mendukung <strong>2 mode</strong>:
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Mode 1 — SSO Redirect (utama)</p>
            <p className="text-xs text-blue-600">Query param <code className="font-mono">?sso_token=xxx</code> dari deep link portal. Single-use, 5 menit. Mengembalikan <code className="font-mono">sessionToken</code> 24 jam.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">Mode 2 — Bearer Token (dev/testing)</p>
            <p className="text-xs text-slate-500">Header <code className="font-mono">Authorization: Bearer</code> dari <code className="font-mono">/api/sso/login</code>. Reusable selama 24 jam.</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Request Headers</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="X-App-Token" type="string" required desc="Token aplikasi yang didaftarkan di portal" />
            <Field name="Authorization" type="string" desc='Mode 2: "Bearer <session_token>" — tidak perlu jika pakai sso_token' />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="bash" code={`# Mode 1: SSO Redirect (dari deep link portal)
curl -X GET "${BASE_URL}/api/sso/validate?sso_token=abc123..." \\
  -H "X-App-Token: your-app-token-here"

# Mode 2: Bearer Token (development)
curl -X GET "${BASE_URL}/api/sso/validate" \\
  -H "X-App-Token: your-app-token-here" \\
  -H "Authorization: Bearer a3f8c2d1e9b4..."`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`// Mode 1 (sso_token) — sessionToken untuk disimpan apps
{
  "valid": true,
  "mode": "redirect",
  "sessionToken": "f9e2a1b3...",   // simpan untuk request berikutnya
  "expiresAt": "2026-06-12T10:00:00.000Z",
  "user": { /* sama dengan struktur di bawah */ }
}

// Mode 2 (Bearer) — user object lengkap
{
  "valid": true,
  "mode": "session",
  "expiresAt": "2026-06-12T10:00:00.000Z",
  "user": {
    "id": "clxyz123",
    "employeeId": "EMP001",
    "name": "Budi",
    "lastName": "Santoso",
    "email": "budi@euromedica.co.id",
    "phone": "0211234567",
    "mobilePhone": "081234567890",
    "gender": "male",
    "birthPlace": "Jakarta",
    "birthDate": "1996-03-15T00:00:00.000Z",
    "address": "Jl. Sudirman No.1, Jakarta",
    "religion": "Islam",
    "bloodType": "O",
    "maritalStatus": "single",
    "identityType": "ktp",
    "identityNumber": "3171234567890001",
    "jobPositionId": "JP001",
    "jobPositionName": "Software Engineer",
    "jobLevel": "Staff",
    "organizationId": "ORG001",
    "organizationName": "IT Department",
    "branchId": "BR001",
    "branchName": "Jakarta Pusat",
    "employmentStatus": "permanent",
    "age": 28,
    "joinDate": "2022-01-15T00:00:00.000Z",
    "resignDate": null,
    "status": "active",
    "image": "https://talenta.oss-ap-southeast-5.aliyuncs.com/..."
  }
}`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Error</p>
          <CodeBlock code={`// 401 - Token tidak ada atau kadaluarsa
{ "valid": false, "error": "Token sudah kadaluarsa" }

// 403 - Token dari app lain
{ "valid": false, "error": "Token bukan milik app ini" }

// 403 - Akun nonaktif
{ "valid": false, "error": "Akun tidak aktif" }`} />
        </div>
      </Section>

      {/* 3. Users */}
      <Section id="users" icon={Users} title="4. Data Pengguna" open={openSections.has("users")} onToggle={() => toggle("users")}>
        <div className="flex items-center gap-3">
          <Badge method="GET" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/users</code>
        </div>
        <p className="text-sm text-slate-600">
          Mengambil daftar pengguna aktif dengan dukungan pagination dan pencarian.
          Hanya memerlukan App Token, tidak perlu User Token.
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Query Parameters</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="page" type="number" desc="Halaman yang diminta. Default: 1" />
            <Field name="limit" type="number" desc="Jumlah data per halaman. Default: 20, Maks: 100" />
            <Field name="search" type="string" desc="Cari berdasarkan nama, employeeId, email, jabatan, atau departemen" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="bash" code={`// Semua pengguna aktif (halaman 1)
curl -X GET "${BASE_URL}/api/sso/users?page=1&limit=20" \\
  -H "X-App-Token: your-app-token-here"

// Pencarian
curl -X GET "${BASE_URL}/api/sso/users?search=budi&page=1" \\
  -H "X-App-Token: your-app-token-here"`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`{
  "data": [
    {
      "id": "clxyz123",
      "employeeId": "EMP001",
      "name": "Budi",
      "lastName": "Santoso",
      "email": "budi@euromedica.co.id",
      "phone": "0211234567",
      "mobilePhone": "081234567890",
      "gender": "male",
      "birthPlace": "Jakarta",
      "birthDate": "1996-03-15T00:00:00.000Z",
      "address": "Jl. Sudirman No.1, Jakarta",
      "religion": "Islam",
      "bloodType": "O",
      "maritalStatus": "single",
      "identityType": "ktp",
      "identityNumber": "3171234567890001",
      "jobPositionId": "JP001",
      "jobPositionName": "Software Engineer",
      "jobLevel": "Staff",
      "organizationId": "ORG001",
      "organizationName": "IT Department",
      "branchId": "BR001",
      "branchName": "Jakarta Pusat",
      "employmentStatus": "permanent",
      "age": 28,
      "joinDate": "2022-01-15T00:00:00.000Z",
      "resignDate": null,
      "status": "active",
      "image": "https://talenta.oss-ap-southeast-5.aliyuncs.com/..."
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}`} />
        </div>
      </Section>

      {/* 4. Branches */}
      <Section id="branches" icon={GitBranch} title="5. Master Branch" open={openSections.has("branches")} onToggle={() => toggle("branches")}>
        <div className="flex items-center gap-3">
          <Badge method="GET" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/branches</code>
        </div>
        <p className="text-sm text-slate-600">
          Mengambil daftar seluruh branch (cabang) dari master data portal. Data disinkronisasi dari Talenta secara berkala.
          Memerlukan permission <code className="font-mono bg-slate-100 px-1 rounded text-xs">GET_BRANCHES</code> pada App Token.
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Query Parameters</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="search" type="string" desc="Cari berdasarkan nama branch, kota (regency), atau provinsi" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="bash" code={`curl -X GET "${BASE_URL}/api/sso/branches" \\
  -H "X-App-Token: your-app-token-here"

# Dengan pencarian
curl -X GET "${BASE_URL}/api/sso/branches?search=jakarta" \\
  -H "X-App-Token: your-app-token-here"`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`{
  "data": [
    {
      "id": "66384",
      "name": "RS Puri Indah",
      "parentBranchId": "0",
      "address": "Jl. Puri Agung No.1, Jakarta Barat",
      "regencyName": "Jakarta Barat",
      "provinceName": "DKI Jakarta",
      "postalCode": 11610,
      "phone": "02156789012",
      "faxNumber": null,
      "kluCode": null,
      "syncedAt": "2026-06-29T08:00:00.000Z"
    }
  ],
  "total": 96
}`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Keterangan Field</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="id" type="string" desc="ID branch dari Talenta (integer dalam bentuk string)" />
            <Field name="name" type="string" desc="Nama cabang / unit" />
            <Field name="parentBranchId" type="string | null" desc="ID branch induk. Nilai '0' berarti branch utama (tidak ada induk)" />
            <Field name="regencyName" type="string | null" desc="Nama kota/kabupaten" />
            <Field name="provinceName" type="string | null" desc="Nama provinsi" />
            <Field name="postalCode" type="number | null" desc="Kode pos" />
            <Field name="syncedAt" type="datetime" desc="Waktu terakhir data disinkronisasi dari Talenta" />
          </div>
        </div>
      </Section>

      {/* 5. Job Positions */}
      <Section id="job-positions" icon={Briefcase} title="6. Master Jabatan" open={openSections.has("job-positions")} onToggle={() => toggle("job-positions")}>
        <div className="flex items-center gap-3">
          <Badge method="GET" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/job-positions</code>
        </div>
        <p className="text-sm text-slate-600">
          Mengambil daftar jabatan dari master data portal. Data disinkronisasi dari Talenta secara berkala.
          Memerlukan permission <code className="font-mono bg-slate-100 px-1 rounded text-xs">GET_JOB_POSITIONS</code> pada App Token.
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Query Parameters</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="search" type="string" desc="Cari berdasarkan nama jabatan" />
            <Field name="branch_id" type="string" desc="Filter jabatan berdasarkan ID branch tertentu" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="bash" code={`curl -X GET "${BASE_URL}/api/sso/job-positions" \\
  -H "X-App-Token: your-app-token-here"

# Filter per branch
curl -X GET "${BASE_URL}/api/sso/job-positions?branch_id=66384" \\
  -H "X-App-Token: your-app-token-here"

# Pencarian nama jabatan
curl -X GET "${BASE_URL}/api/sso/job-positions?search=dokter" \\
  -H "X-App-Token: your-app-token-here"`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`{
  "data": [
    {
      "id": "1042",
      "name": "Dokter Umum",
      "level": 3,
      "description": null,
      "parentJobId": "1001",
      "branchId": "66384",
      "syncedAt": "2026-06-29T08:00:00.000Z"
    }
  ],
  "total": 415
}`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Keterangan Field</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="id" type="string" desc="ID jabatan dari Talenta (integer dalam bentuk string). Nilai ini sama dengan jobPositionId pada data user" />
            <Field name="name" type="string" desc="Nama jabatan" />
            <Field name="level" type="number | null" desc="Level/grade jabatan" />
            <Field name="parentJobId" type="string | null" desc="ID jabatan induk (untuk struktur hierarki jabatan)" />
            <Field name="branchId" type="string | null" desc="ID branch yang terkait dengan jabatan ini. Cocokkan dengan branch.id" />
            <Field name="syncedAt" type="datetime" desc="Waktu terakhir data disinkronisasi dari Talenta" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Tip: Join dengan data user</p>
          <p className="text-xs text-blue-600">
            Field <code className="font-mono">user.jobPositionId</code> dari endpoint <code className="font-mono">/api/sso/users</code> berisi ID yang sama dengan
            field <code className="font-mono">jobPosition.id</code> di sini, sehingga dapat langsung di-join tanpa transformasi.
          </p>
        </div>
      </Section>

      {/* 6. Companies */}
      <Section id="companies" icon={Building2} title="7. Master Perusahaan" open={openSections.has("companies")} onToggle={() => toggle("companies")}>
        <div className="flex items-center gap-3">
          <Badge method="GET" />
          <code className="text-sm font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded">/api/sso/companies</code>
        </div>
        <p className="text-sm text-slate-600">
          Mengambil daftar perusahaan dalam jaringan Euromedica. Data dikelola secara manual oleh administrator portal.
          Memerlukan permission <code className="font-mono bg-slate-100 px-1 rounded text-xs">GET_COMPANIES</code> pada App Token.
          Hanya perusahaan dengan status <code className="font-mono bg-slate-100 px-1 rounded text-xs">active</code> yang dikembalikan.
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contoh Request</p>
          <CodeBlock lang="bash" code={`curl -X GET "${BASE_URL}/api/sso/companies" \\
  -H "X-App-Token: your-app-token-here"`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Sukses <span className="text-emerald-500 font-mono">200</span></p>
          <CodeBlock code={`{
  "data": [
    {
      "id": "clxyz_company_1",
      "code": "RSPURI",
      "name": "RS Puri Indah",
      "order": 1,
      "status": "active"
    },
    {
      "id": "clxyz_company_2",
      "code": "EUROMEDICA",
      "name": "PT Euromedica Internasional",
      "order": 2,
      "status": "active"
    }
  ],
  "total": 8
}`} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Keterangan Field</p>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <Field name="id" type="string" desc="ID perusahaan (CUID, digunakan sebagai referensi internal)" />
            <Field name="code" type="string" desc="Kode unik perusahaan dalam huruf kapital, contoh: EUROMEDICA, RSPURI" />
            <Field name="name" type="string" desc="Nama lengkap perusahaan" />
            <Field name="order" type="number" desc="Urutan tampil (ascending)" />
            <Field name="status" type="string" desc="Status perusahaan. Endpoint ini hanya mengembalikan yang berstatus 'active'" />
          </div>
        </div>
      </Section>

      {/* Footer note */}
      <div className="text-center py-4 text-xs text-slate-400">
        EuroPortal SSO API · Untuk pertanyaan hubungi tim IT
      </div>
    </div>
  );
}
