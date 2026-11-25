"use client";

// Komponen sosial Euro Update yang dipakai bersama feed (apps/[appSlug]/_eu-feed.tsx) dan
// halaman Profil: avatar/nama yang bisa diklik -> kartu profil, reaction, emoji komentar,
// daftar yang bereaksi, dan thread ucapan ulang tahun (2026-11-16).
import { useEffect, useRef, useState, useCallback, useMemo, createContext, useContext } from "react";
import Image from "next/image";
import { ThumbsUp, Heart, PartyPopper, Lightbulb, X, RefreshCw, Trash2, Briefcase, Building2, MapPin, CalendarCheck, Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export type BirthdayComment = {
  id: string; content: string; createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

export type Reactor = { id: string; name: string | null; image: string | null; jobPositionName: string | null };

export const REACTIONS = [
  { type: "like",       label: "Like",       icon: ThumbsUp,     color: "text-blue-500"   },
  { type: "appreciate", label: "Appreciate", icon: Heart,        color: "text-red-500"    },
  { type: "congrats",   label: "Congrats",   icon: PartyPopper,  color: "text-amber-500"  },
  { type: "useful",     label: "Useful",     icon: Lightbulb,    color: "text-green-500"  },
];

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function InitialAvatar({ name, size = "md" }: { name: string | null; size?: "sm" | "md" }) {
  const initials = (name ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const cls = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export function ReactionBar({ reactions, myReaction, onReact, postId, onShowReactors, disabled = false }: {
  reactions: Record<string, number>; myReaction: string | null;
  onReact: (postId: string, type: string) => void; postId: string;
  onShowReactors?: () => void;
  /** Baca saja (mis. thread ulang tahun yang sudah lewat) — jumlah tetap tampil. */
  disabled?: boolean;
}) {
  const total = Object.values(reactions).reduce((a, b) => a + b, 0);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTIONS.map(({ type, label, icon: Icon, color }) => {
        const count = reactions[type] ?? 0;
        const active = myReaction === type;
        return (
          <button
            key={type}
            onClick={() => onReact(postId, type)}
            disabled={disabled}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors disabled:cursor-default ${
              active
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : `bg-slate-50 border-slate-200 text-slate-500 ${disabled ? "" : "hover:bg-slate-100"}`
            }`}
          >
            <Icon className={`w-3 h-3 ${active ? "text-blue-500" : color}`} />
            {count > 0 && <span>{count}</span>}
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
      {total > 0 && (onShowReactors ? (
        <button type="button" onClick={onShowReactors} className="text-xs text-slate-500 ml-1 hover:text-blue-600 hover:underline transition-colors" title="Lihat siapa saja yang bereaksi">
          {total} reaction
        </button>
      ) : (
        <span className="text-xs text-slate-400 ml-1">{total} reaction</span>
      ))}
    </div>
  );
}

/** Hasil klik reaction, sama dengan logika server (POST .../react): klik jenis yang sama =
 * batal, jenis lain = ganti. Dipakai untuk update langsung tanpa memuat ulang feed — memuat
 * ulang membuat daftar post sempat kosong ("Memuat...") sehingga halaman lompat ke atas. */
export function applyReaction(reactions: Record<string, number>, myReaction: string | null, type: string) {
  const next = { ...reactions };
  if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] ?? 0) - 1);
  if (myReaction === type) return { reactions: next, myReaction: null };
  next[type] = (next[type] ?? 0) + 1;
  return { reactions: next, myReaction: type };
}

/** Taburan ikon reaction di dalam kartu (2026-11-25). Pemanggil memberi `key` baru tiap letupan
 * supaya animasi mulai lagi. Posisi/arah dihitung deterministik dari indeks (tanpa Math.random). */
export function ReactionBurst({ types }: { types: string[] }) {
  const PER_TYPE = 22; // lebih banyak supaya merata di seluruh lebar kartu
  const parts = types.flatMap((type, ti) => Array.from({ length: PER_TYPE }, (_, i) => {
    const n = ti * PER_TYPE + i;
    const h = (k: number) => { const x = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    const r = REACTIONS.find((x) => x.type === type) ?? REACTIONS[0];
    return {
      key: n, Icon: r.icon, color: r.color,
      left: 2 + h(1) * 94,                 // % dari kiri: menyebar di SELURUH lebar kartu
      size: 16 + Math.round(h(2) * 16),
      dx: Math.round((h(3) - 0.5) * 120),  // goyang kiri-kanan saat naik
      dy: -Math.round(260 + h(4) * 520),   // naik melewati seluruh tinggi kartu (di-clip kartu)
      rot: Math.round((h(5) - 0.5) * 180),
      delay: Math.round(h(6) * 2000),           // jeda 0–2 dtk
      dur: Math.round(7000 + h(7) * 1000),      // gerak 7–8 dtk → total maks. 10 dtk
    };
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden>
      {parts.map(({ key, Icon, color, left, size, dx, dy, rot, delay, dur }) => (
        <Icon
          key={key}
          className={`absolute -bottom-6 fill-current ${color}`}
          style={{
            left: `${left}%`, width: size, height: size, opacity: 0,
            ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, ["--rot" as string]: `${rot}deg`,
            animation: `eu-burst ${dur}ms ease-in-out ${delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Kartu profil (2026-11-16) ────────────────────────────────────────────────
// Foto/nama di artikel, komentar, reaction, pembaca, dan ulang tahun bisa diklik untuk
// melihat siapa orangnya. Data diambil dari GET /api/eu/user/[id] (field terbatas).

export type BirthdayTarget = { id: string; name: string | null; image?: string | null; jobPositionName?: string | null };
type EuSocial = { openProfile: (userId: string) => void; openBirthday: (user: BirthdayTarget, year?: number) => void };
const EuSocialCtx = createContext<EuSocial>({ openProfile: () => {}, openBirthday: () => {} });
export const useEuSocial = () => useContext(EuSocialCtx);

export function ProfileLink({ userId, children, className = "" }: { userId: string; children: React.ReactNode; className?: string }) {
  const { openProfile } = useEuSocial();
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openProfile(userId); }}
      className={`text-left hover:opacity-80 transition-opacity ${className}`}
      title="Lihat profil"
    >
      {children}
    </button>
  );
}

export function UserAvatar({ user, size = "md" }: { user: { id: string; name: string | null; image?: string | null }; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  return (
    <ProfileLink userId={user.id} className="flex-shrink-0 rounded-full">
      {user.image ? (
        <div className={`${cls} rounded-full overflow-hidden relative`}>
          <Image src={user.image} alt={user.name ?? ""} fill className="object-cover" unoptimized />
        </div>
      ) : (
        <InitialAvatar name={user.name} size={size} />
      )}
    </ProfileLink>
  );
}

type UserProfile = {
  id: string; name: string | null; image: string | null;
  jobPositionName: string | null; organizationName: string | null; branchName: string | null; joinDate: string | null;
};

function ProfileCardModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [history, setHistory] = useState<{ years: { year: number }[]; birthdayToday: boolean } | null>(null);
  const { openBirthday } = useEuSocial();

  useEffect(() => {
    fetch(`/api/eu/birthday/history?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setHistory(j?.data ?? null))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    fetch(`/api/eu/user/${userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setProfile(j.data))
      .catch(() => setError(true));
  }, [userId]);

  useEffect(() => {
    // Escape hanya menutup kartu ini, bukan modal di bawahnya (detail artikel / pembaca).
    // Kalau foto sedang diperbesar, Escape menutup zoom-nya dulu.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (zoom) setZoom(false); else onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, zoom]);

  const joined = profile?.joinDate
    ? new Date(profile.joinDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const rows = profile ? [
    { icon: Briefcase, label: "Jabatan", value: profile.jobPositionName },
    { icon: Building2, label: "Departemen", value: profile.organizationName },
    { icon: MapPin, label: "Cabang", value: profile.branchName },
    { icon: CalendarCheck, label: "Bergabung sejak", value: joined },
  ].filter((r) => r.value) : [];

  // Di HP muncul dari bawah (bottom sheet), di layar lebar di tengah.
  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-20 bg-gradient-to-br from-blue-500 to-indigo-600">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors" title="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error ? (
          <p className="px-6 py-10 text-sm text-slate-400 text-center">Profil tidak dapat dimuat.</p>
        ) : !profile ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : (
          <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden relative bg-white">
              {profile.image ? (
                <button type="button" onClick={() => setZoom(true)} className="absolute inset-0 cursor-zoom-in" title="Perbesar foto">
                  <Image src={profile.image} alt={profile.name ?? ""} fill className="object-cover" unoptimized />
                </button>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-semibold">
                  {(profile.name ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </div>
              )}
            </div>
            <p className="mt-3 text-lg font-bold text-slate-800">{profile.name ?? "—"}</p>
            {rows.length > 0 && (
              <div className="mt-5 w-full space-y-2.5 text-left">
                {rows.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-slate-700 break-words">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Thread ulang tahun tetap bisa dibuka setelah harinya lewat (baca saja). */}
            {!!history?.years.length && (
              <button
                type="button"
                onClick={() => openBirthday({ id: profile.id, name: profile.name, image: profile.image, jobPositionName: profile.jobPositionName })}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50 text-pink-700 text-sm font-medium hover:bg-pink-100 transition-colors"
              >
                🎂 Ucapan ulang tahun
                {history.birthdayToday && <span className="px-2 py-0.5 rounded-full bg-pink-600 text-white text-[11px]">Hari ini</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Foto diperbesar secukupnya (maks. 480px), bukan layar penuh. */}
      {zoom && profile?.image && (
        <div className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
          <button onClick={() => setZoom(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" title="Tutup">
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.image}
            alt={profile.name ?? ""}
            className="w-[min(480px,90vw)] max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Emoji komentar (2026-11-16) ──────────────────────────────────────────────

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩",
  "🥳", "😇", "🙂", "😉", "🤗", "🤔", "😮", "😢", "😭", "🙏",
  "👍", "👏", "🙌", "💪", "👌", "🤝", "❤️", "💙", "💯", "🔥",
  "✨", "🎉", "🎊", "🎂", "🎁", "🎈", "🌹", "☕", "✅", "🚀",
];

// Tombol 😊 + panel emoji; emoji disisipkan di posisi kursor kotak komentar.
export function EmojiButton({ inputRef, value, onChange }: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const insert = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <div ref={boxRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-full px-2.5 rounded-xl border text-lg leading-none transition-colors ${open ? "bg-blue-50 border-blue-200" : "border-slate-200 hover:bg-slate-50"}`}
        title="Sisipkan emoji"
      >
        😊
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-10 w-64 p-2 bg-white border border-slate-200 rounded-xl shadow-lg grid grid-cols-8 gap-0.5">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => insert(e)} className="h-8 rounded-lg text-lg hover:bg-slate-100 transition-colors">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Siapa yang bereaksi (2026-11-16) ─────────────────────────────────────────
// Dipakai di detail artikel (inline) dan popup dari "N reaction" di kartu feed / ulang tahun.

export function ReactorList({ reactions, reactors, maxHeight = "max-h-36" }: {
  reactions: Record<string, number>; reactors: Record<string, Reactor[]>; maxHeight?: string;
}) {
  const [tab, setTab] = useState<string>("all");
  const all = Object.values(reactors).flat();
  const shown = tab === "all" ? all : (reactors[tab] ?? []);
  return (
    <>
      <div className="flex gap-1.5 flex-wrap mb-3">
        <button
          onClick={() => setTab("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${tab === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
        >
          Semua ({all.length})
        </button>
        {REACTIONS.filter((r) => (reactions[r.type] ?? 0) > 0).map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => setTab(type)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${tab === type ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <Icon className={`w-3 h-3 ${tab === type ? "text-white" : color}`} />
            {label} ({reactions[type]})
          </button>
        ))}
      </div>
      <div className={`space-y-2 ${maxHeight} overflow-y-auto`}>
        {shown.map((u) => (
          <div key={u.id} className="flex items-center gap-2.5">
            <UserAvatar user={u} size="sm" />
            <div className="min-w-0">
              <ProfileLink userId={u.id} className="block max-w-full">
                <p className="text-sm font-medium text-slate-800 truncate hover:underline">{u.name}</p>
              </ProfileLink>
              {u.jobPositionName && <p className="text-xs text-slate-400 truncate">{u.jobPositionName}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export type ReactorData = { reactions: Record<string, number>; reactors: Record<string, Reactor[]> };

/** Popup daftar yang bereaksi — `data` langsung (ulang tahun) atau dimuat dari post `postId`. */
export function ReactorsModal({ postId, data, onClose }: { postId?: string; data?: ReactorData; onClose: () => void }) {
  const [loaded, setLoaded] = useState<ReactorData | null>(data ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (data || !postId) return;
    fetch(`/api/eu/post/${postId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setLoaded({ reactions: j.data.reactions, reactors: j.data.reactors }))
      .catch(() => setError(true));
  }, [postId, data]);

  return (
    <Modal open title="Yang bereaksi" onClose={onClose} boxClassName="max-w-md">
      <div className="px-6 py-4">
        {error ? (
          <p className="text-sm text-red-600 text-center py-6">Gagal memuat.</p>
        ) : !loaded ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : (
          <ReactorList reactions={loaded.reactions} reactors={loaded.reactors} maxHeight="max-h-[55vh]" />
        )}
      </div>
    </Modal>
  );
}


// ─── Thread ucapan ulang tahun (2026-11-16) ───────────────────────────────────
// Per orang per tahun. Di hari ulang tahunnya bisa mengucapkan & memberi reaction; setelah
// lewat baca saja (server juga menolak, lihat isBirthdayThreadOpen di app/lib/eu-birthday.ts).

type BirthdayThread = {
  reactions: Record<string, number>; reactors?: Record<string, Reactor[]>;
  myReaction: string | null; comments: BirthdayComment[]; open: boolean;
};
type BirthdayYear = { year: number; comments: number; reactions: number };

function BirthdayModal({ user, initialYear, onClose, currentUserId }: {
  user: BirthdayTarget; initialYear?: number; onClose: () => void; currentUserId?: string;
}) {
  const [year, setYear] = useState(initialYear ?? new Date().getFullYear());
  const [years, setYears] = useState<BirthdayYear[]>([]);
  const [data, setData] = useState<BirthdayThread | null>(null);
  const [showReactors, setShowReactors] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  // Daftar tahun; kalau dibuka tanpa tahun & tahun ini kosong, tampilkan tahun terakhir.
  useEffect(() => {
    fetch(`/api/eu/birthday/history?userId=${user.id}`)
      .then((r) => r.json())
      .then((j) => {
        const list: BirthdayYear[] = j.data?.years ?? [];
        setYears(list);
        if (initialYear === undefined && list.length && !list.some((y) => y.year === new Date().getFullYear())) setYear(list[0].year);
      })
      .catch(() => {});
  }, [user.id, initialYear]);

  const fetchData = useCallback(() => {
    fetch(`/api/eu/birthday/comment?birthdayUserId=${user.id}&year=${year}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => {});
  }, [user.id, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReact = async (type: string) => {
    const res = await fetch("/api/eu/birthday/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birthdayUserId: user.id, type }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).message ?? "Gagal menyimpan reaction");
    fetchData();
  };

  const handleComment = async () => {
    if (!comment.trim() || posting) return;
    setPosting(true); setError(null);
    const res = await fetch("/api/eu/birthday/comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birthdayUserId: user.id, content: comment }) });
    if (res.ok) setComment("");
    else setError((await res.json().catch(() => ({}))).message ?? "Gagal mengirim ucapan");
    setPosting(false);
    fetchData();
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch("/api/eu/birthday/comment", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }),
    });
    fetchData();
  };

  const open = !!data?.open;
  const yearOptions = years.some((y) => y.year === year) ? years : [{ year, comments: 0, reactions: 0 }, ...years];

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <ProfileLink userId={user.id}>
              <p className="font-semibold text-slate-800 hover:underline">🎂 {user.name}</p>
            </ProfileLink>
            {yearOptions.length > 1 ? (
              <select
                value={year}
                onChange={(e) => { setData(null); setYear(Number(e.target.value)); }}
                className="mt-0.5 text-xs text-slate-500 border border-slate-200 rounded-md px-1.5 py-0.5 bg-white"
              >
                {yearOptions.map((y) => <option key={y.year} value={y.year}>Ulang tahun {y.year}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-400">Ulang tahun {year}{user.jobPositionName ? ` · ${user.jobPositionName}` : ""}</p>
            )}
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {data && (
          <div className="px-4 py-3 border-b border-slate-100">
            <ReactionBar reactions={data.reactions} myReaction={data.myReaction} onReact={(_, type) => void handleReact(type)} postId="" onShowReactors={() => setShowReactors(true)} disabled={!open} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!data && (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
            </div>
          )}
          {data?.comments.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">{open ? "Belum ada ucapan. Jadilah yang pertama! 🎉" : "Tidak ada ucapan."}</p>
          )}
          {data?.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 group/comment">
              <UserAvatar user={c.user} size="sm" />
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <ProfileLink userId={c.user.id}>
                    <p className="text-xs font-semibold text-slate-700 hover:underline">{c.user.name}</p>
                  </ProfileLink>
                  <p className="text-xs text-slate-300 ml-auto">{timeAgo(c.createdAt)}</p>
                  {open && currentUserId === c.user.id && (
                    <button
                      onClick={() => void handleDeleteComment(c.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
        {data && (open ? (
          <div className="p-4 border-t border-slate-100 flex gap-2">
            <input
              ref={commentRef}
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Tulis ucapan..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleComment(); } }}
            />
            <EmojiButton inputRef={commentRef} value={comment} onChange={setComment} />
            <button
              onClick={() => void handleComment()}
              disabled={posting || !comment.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Kirim
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" /> Ucapan ditutup — hari ulang tahunnya sudah lewat
          </div>
        ))}
      </div>
      {showReactors && data?.reactors && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReactorsModal data={{ reactions: data.reactions, reactors: data.reactors }} onClose={() => setShowReactors(false)} />
        </div>
      )}
    </div>
  );
}

/** Daftar tahun ulang tahun seseorang (tab "Ucapan Ulang Tahun" di halaman Profil). */
export function BirthdayHistoryList({ user }: { user: BirthdayTarget }) {
  const [years, setYears] = useState<BirthdayYear[] | null>(null);
  const [today, setToday] = useState(false);
  const { openBirthday } = useEuSocial();

  useEffect(() => {
    fetch(`/api/eu/birthday/history?userId=${user.id}`)
      .then((r) => r.json())
      .then((j) => { setYears(j.data?.years ?? []); setToday(!!j.data?.birthdayToday); })
      .catch(() => setYears([]));
  }, [user.id]);

  if (!years) {
    return <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> Memuat...</div>;
  }
  if (years.length === 0) return <p className="text-sm text-slate-400 text-center py-10">Belum ada ucapan ulang tahun.</p>;

  const thisYear = new Date().getFullYear();
  return (
    <div className="space-y-2">
      {years.map((y) => (
        <button
          key={y.year}
          type="button"
          onClick={() => openBirthday(user, y.year)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
        >
          <span className="text-2xl">🎂</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Ulang tahun {y.year}
              {today && y.year === thisYear && <span className="ml-2 px-2 py-0.5 rounded-full bg-pink-600 text-white text-[11px]">Hari ini</span>}
            </p>
            <p className="text-xs text-slate-400">{y.comments} ucapan · {y.reactions} reaction</p>
          </div>
          <span className="text-xs font-medium text-blue-600">Lihat</span>
        </button>
      ))}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/** Menyediakan kartu profil & modal ulang tahun untuk semua ProfileLink/UserAvatar di dalamnya. */
export function EuSocialProvider({ currentUserId, children }: { currentUserId?: string; children: React.ReactNode }) {
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<{ user: BirthdayTarget; year?: number } | null>(null);
  const value = useMemo<EuSocial>(() => ({
    openProfile: setProfileUserId,
    openBirthday: (user, year) => { setProfileUserId(null); setBirthday({ user, year }); },
  }), []);

  return (
    <EuSocialCtx.Provider value={value}>
      {children}
      {birthday && (
        <BirthdayModal
          key={`${birthday.user.id}-${birthday.year ?? ""}`}
          user={birthday.user}
          initialYear={birthday.year}
          currentUserId={currentUserId}
          onClose={() => setBirthday(null)}
        />
      )}
      {profileUserId && <ProfileCardModal userId={profileUserId} onClose={() => setProfileUserId(null)} />}
    </EuSocialCtx.Provider>
  );
}
