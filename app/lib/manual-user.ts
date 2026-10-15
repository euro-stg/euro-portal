import db from "@/lib/db/db";

/**
 * Field data karyawan untuk user MANUAL (2026-10-15) — sama dengan yang diisi sync Talenta
 * (lihat payload di app/api/talenta/sync/route.ts), supaya user manual (mis. untuk testing)
 * bisa ikut pencocokan approver/blast yang memakai organizationId/jobPositionId/branchId.
 * User Talenta tidak diubah lewat jalur ini — datanya selalu ditimpa sync.
 */
const TEXT_FIELDS = [
  "name", "lastName", "email", "phone", "mobilePhone", "gender", "birthPlace", "address",
  "religion", "bloodType", "maritalStatus", "identityType", "identityNumber", "jobLevel", "employmentStatus",
] as const;
const DATE_FIELDS = ["birthDate", "joinDate", "resignDate"] as const;

export type ManualUserData = Record<string, string | Date | null>;

/**
 * Ambil field yang ADA di body saja (field yang tidak dikirim tidak disentuh). ID organisasi,
 * jabatan, dan cabang dipetakan ke namanya dari data yang sudah ada (sumber yang sama dengan
 * dropdown di UI), jadi pasangan ID–nama selalu konsisten. Return error string kalau invalid.
 */
export async function parseManualUserFields(body: Record<string, unknown>): Promise<{ data: ManualUserData; error: string | null }> {
  const data: ManualUserData = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

  for (const f of TEXT_FIELDS) {
    if (!(f in body)) continue;
    const v = str(body[f]);
    if (f === "name" && !v) return { data, error: "Nama wajib diisi" };
    if (f === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { data, error: "Format email tidak valid" };
    data[f] = v || null;
  }
  for (const f of DATE_FIELDS) {
    if (!(f in body)) continue;
    const v = str(body[f]);
    if (!v) { data[f] = null; continue; }
    const d = new Date(v);
    if (isNaN(d.getTime())) return { data, error: `Tanggal tidak valid: ${f}` };
    data[f] = d;
  }
  if ("status" in body) {
    const v = str(body.status);
    if (v && !["active", "inactive"].includes(v)) return { data, error: "Status harus active atau inactive" };
    if (v) data.status = v;
  }

  const ref: [string, string, () => Promise<string | null>][] = [];
  if ("organizationId" in body) {
    const id = str(body.organizationId);
    ref.push(["organizationId", "organizationName", async () => id
      ? (await db.organization.findFirst({ where: { id, deletedAt: null }, select: { name: true } }))?.name
        ?? (await db.user.findFirst({ where: { organizationId: id, organizationName: { not: null } }, select: { organizationName: true } }))?.organizationName
        ?? null
      : null]);
  }
  if ("jobPositionId" in body) {
    const id = str(body.jobPositionId);
    ref.push(["jobPositionId", "jobPositionName", async () => id
      ? (await db.user.findFirst({ where: { jobPositionId: id, jobPositionName: { not: null } }, select: { jobPositionName: true } }))?.jobPositionName
        ?? (await db.jobPosition.findUnique({ where: { id }, select: { name: true } }))?.name
        ?? null
      : null]);
  }
  if ("branchId" in body) {
    const id = str(body.branchId);
    ref.push(["branchId", "branchName", async () => id
      ? (await db.user.findFirst({ where: { branchId: id, branchName: { not: null } }, select: { branchName: true } }))?.branchName
        ?? (await db.branch.findUnique({ where: { id }, select: { name: true } }))?.name
        ?? null
      : null]);
  }
  for (const [idField, nameField, resolve] of ref) {
    const id = str(body[idField]);
    const name = await resolve();
    if (id && !name) return { data, error: `${idField === "organizationId" ? "Organisasi" : idField === "jobPositionId" ? "Jabatan" : "Cabang"} tidak ditemukan` };
    data[idField] = id || null;
    data[nameField] = name;
  }
  return { data, error: null };
}
