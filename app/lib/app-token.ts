// Jenis App Token (2026-10-19):
//  - SSO        : terhubung ke 1 aplikasi eksternal (moduleId terisi) — kartu dashboard, login via portal.
//  - Integrasi  : tanpa aplikasi (moduleId null), cukup nama sistem — hanya untuk endpoint data.
// Permission di bawah butuh aplikasi (generate-link / validate mengambil role user DI aplikasi
// itu), jadi tidak boleh dimiliki token integrasi.
export const SSO_ONLY_PERMISSIONS = ["LOGIN", "VALIDATE"] as const;

export type AppTokenKind = "sso" | "integration";
export const tokenKind = (t: { moduleId: string | null }): AppTokenKind => (t.moduleId ? "sso" : "integration");

/** Pesan error kalau role berisi permission yang tidak boleh untuk token integrasi; null = aman. */
export function integrationRoleError(role: { name: string; permissions: string[] }): string | null {
  const bad = role.permissions.filter((p) => (SSO_ONLY_PERMISSIONS as readonly string[]).includes(p));
  return bad.length
    ? `Role "${role.name}" berisi permission ${bad.join(", ")} yang hanya untuk token Aplikasi SSO. Pilih role tanpa permission tersebut untuk token Integrasi Sistem.`
    : null;
}
