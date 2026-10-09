// Dipakai bersama oleh viewer PDF (client) dan GET /api/edoc/file/[id]/view (server) —
// sengaja file terpisah dari lib/edoc.ts yang mengimpor DB (tidak boleh ikut bundle client).
export const EDOC_VIEWER_HEADER = "x-edoc-viewer";
