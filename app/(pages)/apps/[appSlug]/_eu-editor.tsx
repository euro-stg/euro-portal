"use client";

import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link2, Unlink, Undo2, Redo2 } from "lucide-react";
import { contentToHtml } from "@/lib/eu-content";

// Rich-text editor konten post Euro Update (2026-10-22). Hanya format yang ada di toolbar ini
// yang lolos sanitasi server (app/lib/eu-sanitize.ts) — kalau menambah tombol, tambahkan juga
// tag-nya di allowlist sana. Gambar tidak di sini: pakai Lampiran.
export function EuRichTextEditor({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (html: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false, codeBlock: false, horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
    ],
    // Post lama (teks biasa) dikonversi ke paragraf supaya baris barunya tetap.
    content: contentToHtml(value),
    editable: !disabled,
    immediatelyRender: false, // wajib untuk Next (SSR) — editor baru dibuat di client
    editorProps: {
      attributes: {
        class: "eu-content min-h-[140px] max-h-[360px] overflow-y-auto px-3 py-2 text-sm text-slate-700 focus:outline-none",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="border border-slate-200 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"),
      link: e.isActive("link"), canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Alamat link (https://...)", prev);
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const btn = (active: boolean, onClick: () => void, title: string, Icon: typeof Bold, disabled = false) => (
    // preventDefault di mousedown: tombol tidak boleh merebut fokus dari editor — kalau fokus
    // tertinggal di tombol, ketikan berikutnya hilang & spasi malah "mengklik" tombol lagi.
    <button key={title} type="button" title={title} onClick={onClick} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 ${active ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
  const sep = (k: string) => <span key={k} className="w-px h-5 bg-slate-200 mx-1" />;
  const c = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 bg-slate-50 rounded-t-md">
      {btn(s.bold, () => c().toggleBold().run(), "Tebal (Ctrl+B)", Bold)}
      {btn(s.italic, () => c().toggleItalic().run(), "Miring (Ctrl+I)", Italic)}
      {btn(s.underline, () => c().toggleUnderline().run(), "Garis bawah (Ctrl+U)", Underline)}
      {btn(s.strike, () => c().toggleStrike().run(), "Coret", Strikethrough)}
      {sep("a")}
      {btn(s.h2, () => c().toggleHeading({ level: 2 }).run(), "Judul", Heading2)}
      {btn(s.h3, () => c().toggleHeading({ level: 3 }).run(), "Sub judul", Heading3)}
      {sep("b")}
      {btn(s.bullet, () => c().toggleBulletList().run(), "Daftar berpoin", List)}
      {btn(s.ordered, () => c().toggleOrderedList().run(), "Daftar bernomor", ListOrdered)}
      {btn(s.quote, () => c().toggleBlockquote().run(), "Kutipan", Quote)}
      {sep("c")}
      {btn(s.link, setLink, "Link", Link2)}
      {s.link && btn(false, () => c().extendMarkRange("link").unsetLink().run(), "Hapus link", Unlink)}
      {sep("d")}
      {btn(false, () => c().undo().run(), "Urungkan (Ctrl+Z)", Undo2, !s.canUndo)}
      {btn(false, () => c().redo().run(), "Ulangi", Redo2, !s.canRedo)}
    </div>
  );
}
