"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Search, ChevronLeft, ChevronRight, MessageCircle, Paperclip, Pin, ShieldAlert, RefreshCw, Cake, CalendarDays, Megaphone, ThumbsUp, Heart, PartyPopper, Lightbulb, PenSquare, ImagePlus, X, Loader2, Send, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; icon: string | null; color: string | null };

type Attachment = { id: string; name: string; url: string; mimeType: string | null; order: number };

type Post = {
  id: string; title: string; content: string;
  isPinned: boolean; isMandatory: boolean; publishedAt: string;
  category: Category;
  author: { id: string; name: string | null; image: string | null; jobPositionName: string | null };
  attachments: Attachment[];
  reactions: Record<string, number>;
  myReaction: string | null;
  commentCount: number;
  _count: { readLogs: number };
};

type BirthdayUser = {
  id: string; name: string | null; image: string | null;
  jobPositionName: string | null; organizationName: string | null;
  reactions: Record<string, number>; myReaction: string | null; commentCount: number;
};

type BirthdayComment = {
  id: string; content: string; createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

type Reactor = { id: string; name: string | null; image: string | null; jobPositionName: string | null };

type PostComment = {
  id: string; content: string; createdAt: string;
  user: { id: string; name: string | null; image: string | null; jobPositionName: string | null };
};

type DetailPost = Post & {
  comments: PostComment[];
  reactors: Record<string, Reactor[]>;
};

type Me = { canPost: boolean; isSuperadmin: boolean; userId: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REACTIONS = [
  { type: "like",       label: "Like",       icon: ThumbsUp,     color: "text-blue-500"   },
  { type: "appreciate", label: "Appreciate", icon: Heart,        color: "text-red-500"    },
  { type: "congrats",   label: "Congrats",   icon: PartyPopper,  color: "text-amber-500"  },
  { type: "useful",     label: "Useful",     icon: Lightbulb,    color: "text-green-500"  },
];

function timeAgo(iso: string) {
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

function isImage(mimeType: string | null) {
  return mimeType?.startsWith("image/") ?? false;
}

function InitialAvatar({ name, size = "md" }: { name: string | null; size?: "sm" | "md" }) {
  const initials = (name ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const cls = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function ReactionBar({ reactions, myReaction, onReact, postId }: {
  reactions: Record<string, number>; myReaction: string | null;
  onReact: (postId: string, type: string) => void; postId: string;
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
              active
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Icon className={`w-3 h-3 ${active ? "text-blue-500" : color}`} />
            {count > 0 && <span>{count}</span>}
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
      {total > 0 && <span className="text-xs text-slate-400 ml-1">{total} reaction</span>}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function LightboxModal({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
        <X className="w-6 h-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

const CONTENT_PREVIEW_LEN = 280;

function PostCard({ post, onReact, onOpenModal, me, onEdit, onDelete }: {
  post: Post;
  onReact: (postId: string, type: string) => void;
  onOpenModal: (id: string) => void;
  me: Me | null;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const images = post.attachments.filter((a) => isImage(a.mimeType));
  const files  = post.attachments.filter((a) => !isImage(a.mimeType));
  const isLong = post.content.length > CONTENT_PREVIEW_LEN;
  const displayContent = isLong && !expanded ? post.content.slice(0, CONTENT_PREVIEW_LEN) + "…" : post.content;
  const canManage = !!me && (me.isSuperadmin || me.canPost || post.author.id === me.userId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Author row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            {post.author.image ? (
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 relative">
                <Image src={post.author.image} alt={post.author.name ?? ""} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <InitialAvatar name={post.author.name} />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">{post.author.name ?? "—"}</p>
              <p className="text-xs text-slate-400">{post.author.jobPositionName ?? ""} · {timeAgo(post.publishedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {post.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
            {post.isMandatory && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-200">
                <ShieldAlert className="w-3 h-3" /> Wajib
              </span>
            )}
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium border"
              style={{ backgroundColor: post.category.color ? `${post.category.color}18` : undefined, color: post.category.color ?? undefined, borderColor: post.category.color ? `${post.category.color}40` : undefined }}
            >
              {post.category.icon} {post.category.name}
            </span>
            {canManage && (
              <>
                <button
                  onClick={() => onEdit(post)}
                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors rounded"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(post)}
                  className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content + image: stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-800 mb-1 leading-snug">{post.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">{displayContent}</p>
            {isLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                {expanded ? "Tutup" : "Baca selengkapnya"}
              </button>
            )}
          </div>
          {images.length > 0 && (
            <div
              className="relative w-full h-48 sm:w-44 sm:h-32 sm:flex-shrink-0 rounded-xl overflow-hidden cursor-pointer border border-slate-100"
              onClick={() => setLightbox({ url: images[0].url, alt: images[0].name })}
            >
              <Image src={images[0].url} alt={images[0].name} fill className="object-cover" unoptimized />
            </div>
          )}
        </div>

        {/* Extra images (2nd onward) — small row below */}
        {images.length > 1 && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {images.slice(1, 7).map((img, idx) => (
              <div
                key={img.id}
                className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border border-slate-100 bg-slate-50"
                onClick={() => setLightbox({ url: img.url, alt: img.name })}
              >
                <Image src={img.url} alt={img.name} fill className="object-cover" unoptimized />
                {idx === 5 && images.length > 7 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <span className="text-white font-bold text-xs">+{images.length - 7}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* File attachments */}
        {files.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {files.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{a.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {lightbox && <LightboxModal url={lightbox.url} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
        <ReactionBar reactions={post.reactions} myReaction={post.myReaction ?? null} onReact={onReact} postId={post.id} />
        <button
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
          onClick={() => onOpenModal(post.id)}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
          <span>Komentar</span>
        </button>
      </div>
    </div>
  );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

type UploadItem = { id: string; name: string; url: string; mimeType: string; uploading: boolean; isExisting?: boolean };

function CreatePostModal({ categories, onClose, onCreated }: {
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "", content: "", categoryId: "",
    isPinned: false, isMandatory: false, publishNow: true,
  });
  const [attachments, setAttachments] = useState<UploadItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasUploading = attachments.some((a) => a.uploading);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const tempId = `${Date.now()}-${Math.random()}`;
      setAttachments((prev) => [...prev, { id: tempId, name: file.name, url: "", mimeType: file.type, uploading: true }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/eu/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setAttachments((prev) => prev.filter((a) => a.id !== tempId));
          setError(json.message ?? "Upload gagal");
        } else {
          const fileUrl = `/api/eu/file?path=${encodeURIComponent(json.path)}`;
          setAttachments((prev) => prev.map((a) => a.id === tempId ? { id: tempId, name: file.name, url: fileUrl, mimeType: file.type, uploading: false } : a));
        }
      } catch {
        setAttachments((prev) => prev.filter((a) => a.id !== tempId));
        setError("Upload gagal");
      }
    }
  };

  const handleRemove = async (item: UploadItem) => {
    setAttachments((prev) => prev.filter((a) => a.id !== item.id));
    if (item.url) {
      try {
        const params = new URLSearchParams(item.url.split("?")[1]);
        const path = params.get("path");
        if (path) await fetch(`/api/eu/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      } catch { /* best-effort delete */ }
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Judul wajib diisi"); return; }
    if (!form.content.trim()) { setError("Konten wajib diisi"); return; }
    if (!form.categoryId) { setError("Kategori wajib dipilih"); return; }
    if (hasUploading) { setError("Tunggu upload selesai"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/eu/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          attachments: attachments
            .filter((a) => !a.uploading && a.url)
            .map((a, i) => ({ name: a.name, url: a.url, mimeType: a.mimeType, order: i })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? "Gagal membuat post"); return; }
      onCreated();
      onClose();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const files  = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  return (
    <Modal open title="Tulis Post" onClose={onClose} boxClassName="w-full max-w-lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && <Alert variant="error" message={error} />}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Judul *</label>
          <input className={inputCls} placeholder="Judul post..." value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategori *</label>
          <select className={inputCls} value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
            <option value="">Pilih kategori...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konten *</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            placeholder="Tulis isi post di sini..."
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          />
        </div>

        {/* Lampiran */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lampiran</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <ImagePlus className="w-3.5 h-3.5" /> Tambah Gambar / File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
          </div>

          {/* Image previews */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  {img.uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => void handleRemove(img)}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File attachments */}
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {f.uploading
                    ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                    : <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                  <span className="text-sm text-slate-600 flex-1 truncate">{f.name}</span>
                  <button onClick={() => void handleRemove(f)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opsi</label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.isPinned} onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))} />
            <span className="text-sm text-slate-700">📌 Pin ke slider beranda</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.isMandatory} onChange={(e) => setForm((p) => ({ ...p, isMandatory: e.target.checked }))} />
            <span className="text-sm text-slate-700">🔴 Wajib dibaca</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.publishNow} onChange={(e) => setForm((p) => ({ ...p, publishNow: e.target.checked }))} />
            <span className="text-sm text-slate-700">Publikasikan sekarang</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-slate-100">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving || hasUploading}>
          {saving ? "Menyimpan..." : hasUploading ? "Menunggu upload..." : "Publikasikan"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Edit Post Modal ──────────────────────────────────────────────────────────

function EditPostModal({ post, categories, onClose, onSaved }: {
  post: Post;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title:       post.title,
    content:     post.content,
    categoryId:  post.category.id,
    isPinned:    post.isPinned,
    isMandatory: post.isMandatory,
  });
  const [attachments, setAttachments] = useState<UploadItem[]>(() =>
    post.attachments.map((a) => ({
      id: a.id, name: a.name, url: a.url,
      mimeType: a.mimeType ?? "", uploading: false, isExisting: true,
    }))
  );
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const fileInputRef           = useRef<HTMLInputElement>(null);
  const hasUploading           = attachments.some((a) => a.uploading);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const tempId = `${Date.now()}-${Math.random()}`;
      setAttachments((prev) => [...prev, { id: tempId, name: file.name, url: "", mimeType: file.type, uploading: true }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/eu/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setAttachments((prev) => prev.filter((a) => a.id !== tempId));
          setError(json.message ?? "Upload gagal");
        } else {
          const fileUrl = `/api/eu/file?path=${encodeURIComponent(json.path)}`;
          setAttachments((prev) => prev.map((a) => a.id === tempId
            ? { id: tempId, name: file.name, url: fileUrl, mimeType: file.type, uploading: false }
            : a));
        }
      } catch {
        setAttachments((prev) => prev.filter((a) => a.id !== tempId));
        setError("Upload gagal");
      }
    }
  };

  const handleRemove = async (item: UploadItem) => {
    setAttachments((prev) => prev.filter((a) => a.id !== item.id));
    if (!item.isExisting && item.url) {
      try {
        const params = new URLSearchParams(item.url.split("?")[1]);
        const path = params.get("path");
        if (path) await fetch(`/api/eu/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      } catch { /* best-effort */ }
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim())   { setError("Judul wajib diisi"); return; }
    if (!form.content.trim()) { setError("Konten wajib diisi"); return; }
    if (!form.categoryId)     { setError("Kategori wajib dipilih"); return; }
    if (hasUploading)         { setError("Tunggu upload selesai"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/eu/post/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          attachments: attachments
            .filter((a) => !a.uploading && a.url)
            .map((a, i) => ({ name: a.name, url: a.url, mimeType: a.mimeType, order: i })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? "Gagal menyimpan"); return; }
      onSaved();
      onClose();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const files  = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  return (
    <Modal open title="Edit Post" onClose={onClose} boxClassName="w-full max-w-lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && <Alert variant="error" message={error} />}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Judul *</label>
          <input className={inputCls} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategori *</label>
          <select className={inputCls} value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
            <option value="">Pilih kategori...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konten *</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          />
        </div>

        {/* Lampiran */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lampiran</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <ImagePlus className="w-3.5 h-3.5" /> Tambah Gambar / File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  {img.uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => void handleRemove(img)}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {f.uploading
                    ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                    : <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                  <span className="text-sm text-slate-600 flex-1 truncate">{f.name}</span>
                  <button onClick={() => void handleRemove(f)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opsi</label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.isPinned} onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))} />
            <span className="text-sm text-slate-700">📌 Pin ke slider beranda</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.isMandatory} onChange={(e) => setForm((p) => ({ ...p, isMandatory: e.target.checked }))} />
            <span className="text-sm text-slate-700">🔴 Wajib dibaca</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-slate-100">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving || hasUploading}>
          {saving ? "Menyimpan..." : hasUploading ? "Menunggu upload..." : "Simpan Perubahan"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Birthday Widget ──────────────────────────────────────────────────────────

function BirthdayWidget({ onOpen }: { onOpen: (user: BirthdayUser) => void }) {
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eu/birthday")
      .then((r) => r.json())
      .then((j) => setBirthdays(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (birthdays.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Cake className="w-4 h-4 text-pink-500" />
        <span className="text-sm font-semibold text-slate-700">Ulang Tahun Hari Ini</span>
        <span className="ml-auto text-xs font-medium bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full border border-pink-200">{birthdays.length}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {birthdays.map((u) => (
          <button
            key={u.id}
            onClick={() => onOpen(u)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
          >
            {u.image ? (
              <div className="w-8 h-8 rounded-full overflow-hidden relative flex-shrink-0">
                <Image src={u.image} alt={u.name ?? ""} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <InitialAvatar name={u.name} size="sm" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
              <p className="text-xs text-slate-400 truncate">{u.jobPositionName ?? u.organizationName ?? ""}</p>
            </div>
            <span className="text-lg">🎂</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Upcoming Events Widget ───────────────────────────────────────────────────

function UpcomingEventsWidget({ onClick }: { onClick: (id: string) => void }) {
  const [events, setEvents] = useState<Post[]>([]);

  useEffect(() => {
    fetch("/api/eu/post?categoryId=&all=true")
      .then((r) => r.json())
      .then((j) => {
        const evts = (j.data ?? []).filter((p: Post) => p.category.name === "Event").slice(0, 3);
        setEvents(evts);
      })
      .catch(() => {});
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-semibold text-slate-700">Event Terbaru</span>
      </div>
      <div className="divide-y divide-slate-50">
        {events.map((e) => {
          const thumb = e.attachments.find((a) => isImage(a.mimeType));
          return (
            <button key={e.id} onClick={() => onClick(e.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
              {thumb ? (
                <div className="w-12 h-10 rounded-md overflow-hidden relative flex-shrink-0">
                  <Image src={thumb.url} alt={e.title} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-12 h-10 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0 text-lg">🎉</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-tight">{e.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{timeAgo(e.publishedAt)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Announcement Widget ──────────────────────────────────────────────────────

function AnnouncementWidget({ onClick }: { onClick: (id: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch("/api/eu/post?categoryId=&all=true")
      .then((r) => r.json())
      .then((j) => {
        const filtered = (j.data ?? []).filter((p: Post) =>
          p.category.name === "Announcement" || p.category.name === "Pengumuman"
        ).slice(0, 3);
        setPosts(filtered);
      })
      .catch(() => {});
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-semibold text-slate-700">Pengumuman Terbaru</span>
      </div>
      <div className="divide-y divide-slate-50">
        {posts.map((p) => {
          const thumb = p.attachments.find((a) => isImage(a.mimeType));
          return (
            <button key={p.id} onClick={() => onClick(p.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
              {thumb ? (
                <div className="w-12 h-10 rounded-md overflow-hidden relative flex-shrink-0">
                  <Image src={thumb.url} alt={p.title} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-12 h-10 rounded-md bg-orange-50 flex items-center justify-center flex-shrink-0 text-lg">📢</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-tight">{p.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{timeAgo(p.publishedAt)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hero Slider (Pinned Posts) ───────────────────────────────────────────────

function HeroSlider({ posts, onClickPost }: { posts: Post[]; onClickPost: (id: string) => void }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % posts.length), 5000);
  }, [posts.length]);

  useEffect(() => {
    if (posts.length <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [posts.length, resetTimer]);

  if (posts.length === 0) return null;

  const safeIndex = current % posts.length;
  const post = posts[safeIndex];
  if (!post) return null;
  const thumb = post.attachments.find((a) => isImage(a.mimeType));
  const bgColor = post.category.color ?? "#1e40af";

  return (
    <div className="relative rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/6] cursor-pointer mb-4" onClick={() => onClickPost(post.id)}>
      {thumb ? (
        <Image src={thumb.url} alt={post.title} fill className="object-cover" unoptimized priority />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${bgColor}cc, ${bgColor}55)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="mb-2">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white/90 border border-white/30 backdrop-blur-sm"
            style={{ backgroundColor: `${bgColor}80` }}
          >
            {post.category.icon} {post.category.name}
          </span>
        </div>
        <h2 className="text-white text-xl font-bold drop-shadow line-clamp-2 leading-snug">{post.title}</h2>
        <p className="text-white/75 text-sm mt-1 line-clamp-2 leading-relaxed">{post.content}</p>
        <p className="text-white/50 text-xs mt-2">{post.author.name ?? ""}</p>
      </div>
      {posts.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c - 1 + posts.length) % posts.length); resetTimer(); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c + 1) % posts.length); resetTimer(); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {posts.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); resetTimer(); }} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Birthday Modal ───────────────────────────────────────────────────────────

function BirthdayModal({ user, onClose, currentUserId }: { user: BirthdayUser; onClose: () => void; currentUserId?: string }) {
  const [data, setData] = useState<{ reactions: Record<string, number>; myReaction: string | null; comments: BirthdayComment[] } | null>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const year = new Date().getFullYear();

  const fetchData = useCallback(() => {
    fetch(`/api/eu/birthday/comment?birthdayUserId=${user.id}&year=${year}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => {});
  }, [user.id, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReact = async (type: string) => {
    await fetch("/api/eu/birthday/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birthdayUserId: user.id, type }) });
    fetchData();
  };

  const handleComment = async () => {
    if (!comment.trim() || posting) return;
    setPosting(true);
    await fetch("/api/eu/birthday/comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birthdayUserId: user.id, content: comment }) });
    setComment("");
    setPosting(false);
    fetchData();
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch("/api/eu/birthday/comment", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }),
    });
    fetchData();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          {user.image ? (
            <div className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0">
              <Image src={user.image} alt={user.name ?? ""} fill className="object-cover" unoptimized />
            </div>
          ) : <InitialAvatar name={user.name} />}
          <div>
            <p className="font-semibold text-slate-800">🎂 {user.name}</p>
            <p className="text-xs text-slate-400">{user.jobPositionName ?? ""}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {data && (
          <div className="px-4 py-3 border-b border-slate-100">
            <ReactionBar reactions={data.reactions} myReaction={data.myReaction} onReact={(_, type) => void handleReact(type)} postId="" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {data?.comments.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Belum ada ucapan. Jadilah yang pertama! 🎉</p>}
          {data?.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 group/comment">
              <InitialAvatar name={c.user.name} size="sm" />
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-700">{c.user.name}</p>
                  {currentUserId === c.user.id && (
                    <button
                      onClick={() => void handleDeleteComment(c.id)}
                      className="ml-auto text-red-400 hover:text-red-600 transition-colors"
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

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <input
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            placeholder="Tulis ucapan..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleComment(); } }}
          />
          <button
            onClick={() => void handleComment()}
            disabled={posting || !comment.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Kirim
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post Detail Modal ────────────────────────────────────────────────────────

function PostDetailModal({
  postId,
  onClose,
  onReacted,
  currentUserId,
}: {
  postId: string;
  onClose: () => void;
  onReacted: (postId: string, type: string) => void;
  currentUserId?: string;
}) {
  const [post, setPost]         = useState<DetailPost | null>(null);
  const [loading, setLoading]   = useState(true);
  const [comment, setComment]   = useState("");
  const [posting, setPosting]   = useState(false);
  const [reactorTab, setReactorTab] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPost = useCallback(() => {
    fetch(`/api/eu/post/${postId}`)
      .then((r) => r.json())
      .then((j) => { setPost(j.data ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    fetchPost();
    fetch(`/api/eu/post/${postId}/read`, { method: "POST" }).catch(() => {});
  }, [postId, fetchPost]);

  const handleReact = async (type: string) => {
    await fetch(`/api/eu/post/${postId}/react`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }),
    });
    fetchPost();
    onReacted(postId, type);
  };

  const handleComment = async () => {
    if (!comment.trim() || posting) return;
    setPosting(true);
    try {
      await fetch(`/api/eu/post/${postId}/comment`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: comment }),
      });
      setComment("");
      fetchPost();
    } catch { /* ignored */ } finally { setPosting(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch(`/api/eu/post/${postId}/comment`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }),
    });
    fetchPost();
  };

  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  const allReactors: Reactor[] = post ? Object.values(post.reactors).flat() : [];
  const displayedReactors = reactorTab === "all" ? allReactors : (post?.reactors[reactorTab] ?? []);
  const totalReactions = post ? Object.values(post.reactions).reduce((a, b) => a + b, 0) : 0;

  const images = post?.attachments.filter((a) => isImage(a.mimeType)) ?? [];
  const files  = post?.attachments.filter((a) => !isImage(a.mimeType)) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
          {post && (
            <>
              {post.author.image ? (
                <div className="w-9 h-9 rounded-full overflow-hidden relative flex-shrink-0">
                  <Image src={post.author.image} alt={post.author.name ?? ""} fill className="object-cover" unoptimized />
                </div>
              ) : <InitialAvatar name={post?.author.name ?? null} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{post.author.name ?? "—"}</p>
                <p className="text-xs text-slate-400">{post.author.jobPositionName ?? ""} · {timeAgo(post.publishedAt)}</p>
              </div>
              <span
                className="hidden sm:inline px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0"
                style={{ backgroundColor: post.category.color ? `${post.category.color}18` : undefined, color: post.category.color ?? undefined, borderColor: post.category.color ? `${post.category.color}40` : undefined }}
              >
                {post.category.icon} {post.category.name}
              </span>
            </>
          )}
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
            </div>
          ) : !post ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Gagal memuat post.</div>
          ) : (
            <>
              {/* Content */}
              <div className="px-5 py-4">
                <h2 className="text-lg font-bold text-slate-800 mb-2">{post.title}</h2>
                {(post.isPinned || post.isMandatory) && (
                  <div className="flex items-center gap-2 mb-3">
                    {post.isPinned && <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Pin className="w-3 h-3" /> Disematkan</span>}
                    {post.isMandatory && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-200"><ShieldAlert className="w-3 h-3" /> Wajib Dibaca</span>}
                  </div>
                )}
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{post.content}</p>
              </div>

              {/* Images */}
              {images.length > 0 && (
                <div className={`px-5 pb-4 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setLightbox({ url: img.url, alt: img.name })}
                      className="block rounded-xl overflow-hidden border border-slate-200 relative aspect-video bg-slate-50 w-full"
                    >
                      <Image src={img.url} alt={img.name} fill className="object-cover" unoptimized />
                    </button>
                  ))}
                </div>
              )}

              {/* File attachments */}
              {files.length > 0 && (
                <div className="px-5 pb-4 flex flex-col gap-1.5">
                  {files.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Reaction bar */}
              <div className="px-5 pb-3 border-t border-slate-100 pt-3">
                <ReactionBar reactions={post.reactions} myReaction={post.myReaction} onReact={(_, type) => void handleReact(type)} postId={post.id} />
              </div>

              {/* Who reacted */}
              {totalReactions > 0 && (
                <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Siapa yang bereaksi</p>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    <button
                      onClick={() => setReactorTab("all")}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${reactorTab === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      Semua ({allReactors.length})
                    </button>
                    {REACTIONS.filter((r) => (post.reactions[r.type] ?? 0) > 0).map(({ type, label, icon: Icon, color }) => (
                      <button
                        key={type}
                        onClick={() => setReactorTab(type)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${reactorTab === type ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                      >
                        <Icon className={`w-3 h-3 ${reactorTab === type ? "text-white" : color}`} />
                        {label} ({post.reactions[type]})
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {displayedReactors.map((u) => (
                      <div key={u.id} className="flex items-center gap-2.5">
                        <InitialAvatar name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                          {u.jobPositionName && <p className="text-xs text-slate-400 truncate">{u.jobPositionName}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="border-t border-slate-100 px-5 py-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Komentar {post.comments.length > 0 && `(${post.comments.length})`}
                </p>
                {post.comments.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Belum ada komentar. Jadilah yang pertama!</p>
                ) : (
                  <div className="space-y-3">
                    {post.comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5 group/comment">
                        <InitialAvatar name={c.user.name} size="sm" />
                        <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-slate-700">{c.user.name}</p>
                            {c.user.jobPositionName && <p className="text-xs text-slate-400">{c.user.jobPositionName}</p>}
                            <p className="text-xs text-slate-300 ml-auto">{timeAgo(c.createdAt)}</p>
                            {currentUserId === c.user.id && (
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
                )}
              </div>
            </>
          )}
        </div>

        {/* Comment input */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
            placeholder="Tulis komentar..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleComment(); } }}
          />
          <button
            onClick={() => void handleComment()}
            disabled={posting || !comment.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-sm font-medium"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {lightbox && <LightboxModal url={lightbox.url} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ─── Main Feed Component ──────────────────────────────────────────────────────

export function EuFeedPage() {
  const [posts, setPosts]             = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimer                   = useRef<NodeJS.Timeout | null>(null);
  const [birthdayModal, setBirthdayModal] = useState<BirthdayUser | null>(null);
  const [createOpen, setCreateOpen]       = useState(false);
  const [editPost, setEditPost]           = useState<Post | null>(null);
  const [me, setMe]                       = useState<Me | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const fetchPosts = useCallback(async (p: number, cat: string | null, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (cat) params.set("categoryId", cat);
      if (q)   params.set("search", q);
      const res  = await fetch(`/api/eu/post?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? "Gagal memuat feed"); return; }
      setPosts(json.data ?? []);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  const refreshPinned = useCallback(() => {
    fetch("/api/eu/post?pinned=true&all=true").then((r) => r.json()).then((j) => setPinnedPosts(j.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      refreshPinned(),
      fetch("/api/eu/category").then((r) => r.json()).then((j) => setCategories(j.data ?? [])).catch(() => {}),
      fetch("/api/eu/me").then((r) => r.json()).then((j: Me) => setMe(j)).catch(() => {}),
    ]);
  }, [refreshPinned]);

  useEffect(() => {
    void fetchPosts(page, activeCategory, search);
  }, [page, activeCategory, search, fetchPosts]);

  const handleSearchInput = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(1); }, 400);
  };

  // Sync ?post= URL param on mount
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (postId) setSelectedPostId(postId);
  }, []);

  const handleReact = async (postId: string, type: string) => {
    await fetch(`/api/eu/post/${postId}/react`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }),
    });
    void fetchPosts(page, activeCategory, search);
  };

  const handleDelete = async (post: Post) => {
    if (!window.confirm(`Hapus post "${post.title}"?`)) return;
    await fetch(`/api/eu/post/${post.id}`, { method: "DELETE" });
    void fetchPosts(page, activeCategory, search);
    refreshPinned();
  };

  const handleOpenModal = (id: string) => {
    setSelectedPostId(id);
    history.pushState(null, "", `${window.location.pathname}?post=${id}`);
  };

  const handleCloseModal = () => {
    setSelectedPostId(null);
    history.pushState(null, "", window.location.pathname);
  };

  return (
    <>
      <div className="flex gap-6 max-w-6xl mx-auto w-full">
        {/* ── Main Feed ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {pinnedPosts.length > 0 && <HeroSlider posts={pinnedPosts} onClickPost={handleOpenModal} />}

          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                  placeholder="Cari update..."
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                />
              </div>
              {me?.canPost && (
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  <PenSquare className="w-3.5 h-3.5" /> Tulis Post
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => { setActiveCategory(null); setPage(1); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!activeCategory ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                Semua
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setPage(1); }}
                  className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeCategory === cat.id ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  style={activeCategory === cat.id ? { backgroundColor: cat.color ?? "#3B82F6", borderColor: cat.color ?? "#3B82F6" } : {}}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="mb-4"><Alert variant="error" message={error} /></div>}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Belum ada post.</div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={(id, type) => void handleReact(id, type)}
                  onOpenModal={handleOpenModal}
                  me={me}
                  onEdit={setEditPost}
                  onDelete={(p) => void handleDelete(p)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Sebelumnya</button>
              <span className="text-sm text-slate-500">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Selanjutnya</button>
            </div>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 hidden lg:flex flex-col gap-4">
          <BirthdayWidget onOpen={setBirthdayModal} />
          <UpcomingEventsWidget onClick={handleOpenModal} />
          <AnnouncementWidget onClick={handleOpenModal} />
        </div>
      </div>

      {birthdayModal && <BirthdayModal user={birthdayModal} onClose={() => setBirthdayModal(null)} currentUserId={me?.userId} />}

      {editPost && (
        <EditPostModal
          post={editPost}
          categories={categories}
          onClose={() => setEditPost(null)}
          onSaved={() => { void fetchPosts(page, activeCategory, search); refreshPinned(); setEditPost(null); }}
        />
      )}

      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          onClose={handleCloseModal}
          onReacted={() => void fetchPosts(page, activeCategory, search)}
          currentUserId={me?.userId}
        />
      )}

      {createOpen && (
        <CreatePostModal
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { void fetchPosts(page, activeCategory, search); refreshPinned(); }}
        />
      )}
    </>
  );
}
