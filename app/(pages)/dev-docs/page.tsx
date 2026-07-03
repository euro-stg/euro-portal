"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Shield, Layers, Code2, FileSignature } from "lucide-react";

type Item = { label: string; desc?: string };
type Block = { heading: string; items: Item[] };
type AppDoc = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  blocks: Block[];
};

const DOCS: AppDoc[] = [
  {
    id: "portal",
    title: "Portal",
    subtitle: "Platform manajemen terpusat Euromedica Group",
    icon: <Layers className="w-5 h-5" />,
    accent: "text-blue-600",
    accentBg: "bg-blue-50 border-blue-100",
    blocks: [
      {
        heading: "Fungsi Bisnis",
        items: [
          {
            label: "Pusat Identitas & Akses",
            desc: "Portal menjadi single source of truth untuk identitas karyawan dan hak akses ke seluruh aplikasi internal Euromedica Group. Setiap karyawan memiliki satu akun yang terhubung dengan data HR di Talenta.",
          },
          {
            label: "Orkestrasi SSO",
            desc: "Aplikasi eksternal (LMS, absensi, dsb.) tidak mengelola password sendiri — mereka mendelegasikan autentikasi ke Portal via App Token JWT. Portal menjadi identity provider tunggal.",
          },
          {
            label: "Governance Role & Modul",
            desc: "Admin mengontrol siapa bisa mengakses fitur apa melalui kombinasi Role dan Modul. Perubahan hak akses berlaku real-time tanpa perlu deployment ulang.",
          },
        ],
      },
      {
        heading: "Manajemen User",
        items: [
          { label: "Sinkronisasi Talenta", desc: "Data karyawan (nama, jabatan, cabang, organisasi, avatar) di-sync dari Talenta HRIS secara manual atau terjadwal via cron job dengan header X-Sync-Secret." },
          { label: "Status Aktif / Nonaktif", desc: "User nonaktif tidak bisa login ke portal maupun aplikasi SSO. Karyawan yang sudah resign (resignDate ≤ hari ini) otomatis diblokir di SSO." },
          { label: "Assign Role", desc: "User bisa memiliki satu role per scope (portal = appId null, atau per aplikasi = appId tertentu). Unique constraint mencegah duplikasi role dalam satu scope." },
          { label: "Default Role", desc: "Role bisa ditandai sebagai default dengan scope: ALL / ORGANIZATION / POSITION / BRANCH / kombinasi. Saat sync Talenta, user yang belum punya role di scope tersebut akan otomatis di-assign." },
          { label: "Bulk Assign & Remove Role", desc: "Admin bisa memilih banyak user sekaligus untuk assign atau hapus role tertentu. Hapus role hanya menghapus roleId yang dipilih, tidak mereset semua role user." },
        ],
      },
      {
        heading: "Manajemen Role & Modul",
        items: [
          { label: "Role", desc: "Entitas yang mengelompokkan hak akses. Satu role punya daftar modul yang bisa diakses. Role bisa di-lock untuk mencegah perubahan tidak sengaja." },
          { label: "Modul", desc: "Representasi menu / fitur dalam aplikasi. Memiliki path (URL), icon, warna, grup, dan urutan tampil di sidebar. Tipe: 'module' (halaman portal) atau 'app' (aplikasi eksternal via SSO)." },
          { label: "Assign Modul ke Role", desc: "Admin memilih modul mana yang bisa diakses oleh suatu role. Perubahan langsung berlaku pada sesi login berikutnya." },
        ],
      },
      {
        heading: "SSO (Single Sign-On)",
        items: [
          { label: "App Token", desc: "Setiap aplikasi eksternal mendapat App Token (JWT) yang di-generate dari Portal. Token berisi permission flag: LOGIN dan/atau VALIDATE." },
          { label: "Alur Login Eksternal (Direct)", desc: "Aplikasi eksternal POST /api/sso/login dengan header X-App-Token dan body {employeeId, password}. Portal validasi kredensial dan kembalikan session token 24 jam." },
          { label: "Alur Login via Portal (Redirect)", desc: "User sudah login ke Portal, klik card aplikasi eksternal → Portal POST /api/sso/generate-link → dapat redirect URL dengan sso_token (single-use, 5 menit). Aplikasi eksternal panggil GET /api/sso/validate?sso_token=... untuk tukar jadi session token." },
          { label: "Validate Session", desc: "GET /api/sso/validate dengan Authorization: Bearer {session_token} untuk memverifikasi session aktif. Kembalikan data user lengkap termasuk role yang dimiliki di aplikasi tersebut." },
          { label: "Revocation", desc: "App Token bisa di-revoke kapan saja dari Portal. Session token di-invalidasi saat login baru (deleteMany session lama per user per app)." },
        ],
      },
      {
        heading: "Infrastruktur & ENV Mode",
        items: [
          { label: "DEVELOPMENT", desc: "Banner oranye di atas navbar. Developer Docs muncul di sidebar. Semua operasi tetap berjalan normal." },
          { label: "REPLICA", desc: "Banner violet. Middleware memblokir semua write (POST/PATCH/PUT/DELETE) kecuali endpoint login: /api/auth/, /api/sso/login, /api/sso/validate, /api/sso/generate-link. Status 423 dikembalikan untuk operasi yang diblokir." },
          { label: "PRODUCTION", desc: "Tidak ada banner. Semua operasi normal. Nilai default jika ENV_MODE tidak diset atau kosong." },
          { label: "Sinkronisasi Cabang & Jabatan", desc: "Endpoint /api/talenta/sync-branch dan /api/talenta/sync-job-position bisa dipanggil via cron dengan header X-Sync-Secret. Data lama tidak dihapus (hanya upsert) untuk menjaga referential integrity." },
        ],
      },
      {
        heading: "Keamanan",
        items: [
          { label: "Autentikasi Portal", desc: "NextAuth dengan database sessions — token disimpan di tabel Session, bisa di-revoke kapan saja. Bukan JWT stateless yang tidak bisa dibatalkan sebelum expired." },
          { label: "Otorisasi Halaman", desc: "Server-side di (pages)/layout.tsx: baca x-pathname dari middleware header, bandingkan dengan daftar modul user. Redirect ke / jika tidak punya akses — tidak bisa bypass dengan akses URL langsung." },
          { label: "Otorisasi API", desc: "Semua route portal (/api/user/, /api/role/, /api/module/, dsb.) dilindungi requireSession(). Return 401 tanpa session valid. Route SSO punya autentikasi sendiri via X-App-Token." },
          { label: "Password", desc: "bcrypt dengan salt rounds default — plaintext tidak pernah disimpan atau di-log." },
          { label: "Reset Password", desc: "Token satu kali pakai dengan expiry. Setelah digunakan, token langsung di-invalidasi." },
          { label: "Enkripsi Data Sensitif", desc: "AES-256-GCM via ENCRYPTION_KEY untuk data yang perlu dienkripsi di database." },
        ],
      },
    ],
  },
  {
    id: "sd",
    title: "Software Development",
    subtitle: "Sistem pengajuan dan tracking permintaan pengembangan software internal",
    icon: <Code2 className="w-5 h-5" />,
    accent: "text-indigo-600",
    accentBg: "bg-indigo-50 border-indigo-100",
    blocks: [
      {
        heading: "Fungsi Bisnis",
        items: [
          {
            label: "Digitalisasi Proses SD",
            desc: "Menggantikan pengajuan manual (email/chat) untuk permintaan pengembangan software internal. Setiap permintaan memiliki lifecycle yang jelas, audit trail lengkap, dan visibilitas status real-time untuk semua pihak.",
          },
          {
            label: "Collaboration IT & User",
            desc: "Tim IT dan requester berkolaborasi dalam satu platform: requester buat permintaan, IT review dan buat dokumen teknis, user setujui, IT kerjakan, user uji (UAT), dan terakhir approve untuk deployment.",
          },
        ],
      },
      {
        heading: "Alur Status Lengkap",
        items: [
          { label: "DRAFT", desc: "Permintaan dibuat requester. Bisa diedit. Belum masuk antrian IT." },
          { label: "SUBMITTED", desc: "Requester submit permintaan. IT mendapat notifikasi untuk mulai review." },
          { label: "IT_REVIEW", desc: "Tim IT sedang menganalisis permintaan, mengestimasi waktu dan biaya, menyiapkan dokumen teknis." },
          { label: "APPROVED_IT", desc: "IT selesai review dan membuat IT Document (spesifikasi teknis, estimasi). Requester perlu mereview dan menyetujui dokumen ini." },
          { label: "APPROVED_USER", desc: "Requester setujui IT Document. Pengerjaan resmi bisa dimulai." },
          { label: "IN_PROGRESS", desc: "Tim IT sedang mengerjakan. IT bisa update progress (persentase) secara berkala. Notifikasi dikirim ke requester." },
          { label: "UAT", desc: "Fitur siap diuji. Requester masuk ke mode User Acceptance Testing." },
          { label: "UAT_REVISION", desc: "Requester menemukan bug atau ketidaksesuaian, memberikan catatan revisi. Kembali ke pengerjaan (IN_PROGRESS)." },
          { label: "DONE", desc: "Requester approve hasil UAT. Permintaan selesai dan diarsip." },
          { label: "REJECTED / CANCELLED", desc: "Bisa terjadi dari status apapun. REJECTED oleh IT atau approver, CANCELLED oleh requester." },
        ],
      },
      {
        heading: "Fitur",
        items: [
          { label: "Request Management", desc: "Buat permintaan dengan judul, deskripsi, tipe (New Feature / Enhancement / Bug Fix / dsb.), dan referensi aplikasi terkait. Auto-generate nomor request: SD-YYYY-NNN." },
          { label: "IT Document", desc: "Tim IT membuat dokumen teknis berisi analisis, spesifikasi implementasi, estimasi waktu dan resource. Dokumen ini perlu disetujui requester sebelum pengerjaan dimulai." },
          { label: "Approval Workflow", desc: "Template approval multi-langkah yang bisa dikonfigurasi admin. Tiap langkah bisa di-assign ke user spesifik, jabatan, atau departemen tertentu." },
          { label: "UAT Module", desc: "Requester melakukan pengujian langsung dari platform. Bisa approve (DONE) atau request revision dengan catatan detail untuk tim IT." },
          { label: "Progress Tracking", desc: "Tim IT update persentase progress pengerjaan. Requester bisa pantau perkembangan real-time." },
          { label: "Lampiran", desc: "Upload file pendukung (screenshot bug, wireframe, dokumen referensi) per request. Disimpan lokal di server." },
          { label: "Environment Info", desc: "Catatan konfigurasi server, environment variable, atau hal teknis lain yang relevan untuk deployment." },
          { label: "Dashboard & Statistik", desc: "Ringkasan total request, in-progress, selesai, dan daftar request terbaru beserta status masing-masing." },
        ],
      },
      {
        heading: "Keamanan",
        items: [
          { label: "Session Required", desc: "Semua endpoint /api/sd/* dilindungi session NextAuth. Return 401 jika tidak terautentikasi." },
          { label: "Validasi Approver", desc: "Aksi approval divalidasi bahwa user yang bertindak adalah approver yang ditunjuk di langkah tersebut. Tidak bisa approve atas nama orang lain." },
          { label: "File Storage Lokal", desc: "Lampiran disimpan di direktori lokal server (/uploads/), tidak ke cloud publik. Akses file via /api/files/ yang juga dilindungi session." },
        ],
      },
    ],
  },
  {
    id: "ssd",
    title: "SSD — Surat Digital",
    subtitle: "Sistem pembuatan, approval, dan pengarsipan surat resmi digital perusahaan",
    icon: <FileSignature className="w-5 h-5" />,
    accent: "text-emerald-600",
    accentBg: "bg-emerald-50 border-emerald-100",
    blocks: [
      {
        heading: "Fungsi Bisnis",
        items: [
          {
            label: "Digitalisasi Surat Resmi",
            desc: "Menggantikan proses surat-menyurat manual dan pengiriman via email. Seluruh siklus surat — dari pembuatan draft hingga penandatanganan dan pengarsipan — dikelola dalam satu platform dengan audit trail lengkap.",
          },
          {
            label: "Standarisasi & Penomoran",
            desc: "Setiap surat mendapat nomor otomatis berdasarkan kode kategori dan urutan tahunan, memastikan konsistensi penomoran di seluruh perusahaan dan mencegah duplikasi.",
          },
        ],
      },
      {
        heading: "Alur Status",
        items: [
          { label: "DRAFT", desc: "Surat dibuat pemohon. Bisa diedit, file draft bisa diganti. Belum masuk alur approval." },
          { label: "SUBMITTED", desc: "Pemohon submit surat. Alur approval dimulai sesuai template yang dikonfigurasi." },
          { label: "APPROVED", desc: "Semua langkah approval telah disetujui. Pemohon bisa upload dokumen final (surat bertandatangan)." },
          { label: "REJECTED", desc: "Ditolak di salah satu langkah approval. Approver wajib memberikan alasan penolakan." },
        ],
      },
      {
        heading: "Fitur",
        items: [
          { label: "Manajemen Surat", desc: "Buat surat dengan perihal, tujuan, PIC, kategori, departemen, dan perusahaan penerbit. Satu surat terikat ke satu perusahaan Euromedica Group." },
          { label: "Nomor Surat Otomatis", desc: "Format nomor berdasarkan kode kategori dan counter tahunan. Unique per kategori per tahun — tidak bisa duplikat meski dibuat bersamaan." },
          { label: "Kategori Surat", desc: "Master data kategori dengan kode unik (contoh: SK, SP, SE). Admin bisa konfigurasi apakah kategori tersebut wajib upload file draft saat pembuatan." },
          { label: "Departemen", desc: "Master data departemen/unit kerja dengan kode. Digunakan untuk filter dan routing approval." },
          { label: "Upload Dokumen", desc: "Dua tahap upload: (1) file draft saat pembuatan surat, (2) file final bertandatangan setelah approved. Disimpan di Nextcloud internal." },
          { label: "Approval Multi-Langkah", desc: "Template approval dikonfigurasi per kombinasi departemen/kategori. Tiap langkah bisa di-assign ke user, jabatan, atau departemen tertentu. Urutan langkah ketat — tidak bisa skip." },
          { label: "Activity Log", desc: "Setiap perubahan status tercatat: siapa yang melakukan, kapan, dan keterangan. Riwayat lengkap tidak bisa dihapus." },
          { label: "Penyimpanan Nextcloud", desc: "File draft dan final diunggah ke cloud storage internal Nextcloud Euromedica. Kredensial server dikonfigurasi via NEXTCLOUD_URL, NEXTCLOUD_USER, NEXTCLOUD_PASS." },
          { label: "Dashboard Statistik", desc: "Total surat, menunggu approval, disetujui, ditolak, dan surat milik sendiri. Data per user yang login." },
        ],
      },
      {
        heading: "Keamanan",
        items: [
          { label: "Session Required", desc: "Semua endpoint /api/ssd/* dilindungi session NextAuth. Return 401 jika tidak terautentikasi." },
          { label: "Validasi Approval per Langkah", desc: "Setiap aksi approve/reject divalidasi bahwa user adalah approver yang ditunjuk di langkah aktif saat itu. Tidak bisa melompat langkah atau approve atas nama orang lain." },
          { label: "Storage Internal", desc: "File disimpan di Nextcloud internal perusahaan, bukan cloud publik. URL file tidak bisa diakses tanpa kredensial Nextcloud." },
          { label: "Immutable Audit Trail", desc: "Activity log tidak bisa diedit atau dihapus via API. Setiap perubahan status selalu menambah record baru, tidak menimpa yang lama." },
        ],
      },
    ],
  },
];

function DocBlock({ block }: { block: Block }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{block.heading}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {block.items.map((item, i) => (
            <div key={i} className="px-5 py-3.5">
              <p className="text-sm font-medium text-slate-800 mb-1">{item.label}</p>
              {item.desc && <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppSection({ doc }: { doc: AppDoc }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden ${doc.accentBg}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:opacity-90 transition-opacity"
      >
        <div className={`${doc.accent} flex-shrink-0`}>{doc.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base ${doc.accent}`}>{doc.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{doc.subtitle}</p>
        </div>
        {open
          ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="bg-white px-6 py-5 space-y-3 border-t border-slate-200">
          {doc.blocks.map((block) => (
            <DocBlock key={block.heading} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DevDocsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Developer Documentation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dokumentasi internal fungsi bisnis, fitur, dan keamanan aplikasi Euro Portal.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            ⚠ Hanya tampil di mode Superadmin
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {DOCS.map((doc) => (
          <AppSection key={doc.id} doc={doc} />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center pb-4">
        Euro Portal · Euromedica Group · Internal Use Only
      </p>
    </div>
  );
}
