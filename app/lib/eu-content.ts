// Konten post Euro Update (2026-10-22) — sejak ada rich-text editor, konten disimpan sebagai
// HTML (sudah disanitasi server, lihat eu-sanitize.ts). Post lama masih teks biasa, jadi semua
// tampilan lewat helper ini supaya keduanya tetap benar tanpa migrasi data.
// Aman dipakai di client maupun server (tidak ada dependensi Node).

const HTML_TAG = /<\/?(p|br|h[1-6]|ul|ol|li|strong|b|em|i|u|s|a|blockquote|code|pre)\b[^>]*>/i;

/** true kalau konten berasal dari editor (HTML), false untuk post lama berupa teks biasa. */
export function isHtmlContent(content: string): boolean {
  return HTML_TAG.test(content);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeEntities = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&amp;/g, "&");

/** Teks polos untuk potongan di kartu feed, slider, beranda portal, dan notifikasi. */
export function contentToText(content: string): string {
  if (!isHtmlContent(content)) return content;
  return decodeEntities(
    content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  ).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** HTML untuk ditampilkan / dimuat ke editor. Teks lama di-escape & baris barunya dipertahankan. */
export function contentToHtml(content: string): string {
  if (isHtmlContent(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ─── Video YouTube (2026-11-13) ──────────────────────────────────────────────

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** ID video dari link YouTube (watch, youtu.be, shorts, live, embed) — null kalau bukan link
 * YouTube yang valid. Yang disimpan & dirender hanya ID ini, jadi URL mentah dari user tidak
 * pernah masuk ke src iframe. */
export function parseYoutubeId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/]+)/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Link tampilan untuk form edit. */
export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Input `youtubeUrl` dari body API: undefined = tidak diubah, "" = hapus video. */
export function parseYoutubeInput(raw: unknown): { value?: string | null; error?: string } {
  if (raw === undefined) return {};
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { value: null };
  const id = parseYoutubeId(s);
  return id ? { value: id } : { error: "Link YouTube tidak valid" };
}
