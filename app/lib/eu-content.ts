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
