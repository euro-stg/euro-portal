import sanitizeHtml from "sanitize-html";
import { isHtmlContent } from "@/lib/eu-content";

// Sanitasi konten post Euro Update (2026-10-22) — hanya tag/atribut yang bisa dihasilkan
// toolbar editor yang lolos. Walau yang bisa posting cuma orang tertentu, konten tampil ke
// SEMUA karyawan: akun poster yang dibobol atau HTML yang ditempel dari Word/web tidak boleh
// bisa menyisipkan script, iframe, event handler, atau link javascript:.
// Dipanggil saat simpan (POST/PATCH) DAN saat dibaca (GET), jadi browser selalu menerima
// konten yang sudah bersih. Server-only (sanitize-html memakai parser Node).
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "code", "pre"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
  },
};

/** Bersihkan konten HTML; teks biasa (post lama) dikembalikan apa adanya. */
export function sanitizeEuContent(content: string): string {
  return isHtmlContent(content) ? sanitizeHtml(content, OPTIONS) : content;
}
