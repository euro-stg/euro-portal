// Redirect balik setelah login (2026-11-13) — link yang dibuka saat belum login (mis. share
// link artikel Euro Update) dibawa sebagai ?callbackUrl= ke /sign-in, lalu dipakai lagi
// setelah login berhasil. Client-safe (tanpa next/headers).

/** Hanya path internal portal ("/..."), bukan "//host" atau "/\host" — cegah open redirect. */
export function safeCallbackUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

/** URL halaman login yang membawa alamat asal (x-url dari middleware.ts). */
export function signInUrl(currentUrl: string | null | undefined): string {
  const target = safeCallbackUrl(currentUrl);
  return target === "/" ? "/sign-in" : `/sign-in?callbackUrl=${encodeURIComponent(target)}`;
}
