import db from "@/lib/db/db";

/**
 * Returns true if the user's profile matches any step in the active SSD approval template.
 * Used to decide whether to show the "Approval Masuk" menu — stable (template-based, not
 * dependent on whether there are currently pending letters).
 */
export async function isSsdApprover(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { jobPositionId: true, organizationId: true, branchId: true },
  });
  if (!user) return false;

  const template = await db.ssdApprovalTemplate.findFirst({
    where: { active: true, deletedAt: null },
    select: { steps: { select: { jobPositionId: true, organizationId: true, branchId: true } } },
  });
  if (!template || template.steps.length === 0) return false;

  return template.steps.some(
    (step) =>
      (!step.jobPositionId || step.jobPositionId === user.jobPositionId) &&
      (!step.organizationId || step.organizationId === user.organizationId) &&
      (!step.branchId || step.branchId === user.branchId),
  );
}

/**
 * Returns a Prisma `where` clause that scopes SsdLetter queries to what
 * the given user is allowed to see:
 *   - superadmin → no restriction
 *   - approver (matches active template step) → no restriction
 *   - SSD org admin → all letters milik org yang di-assign
 *   - user lain → hanya surat sendiri (requestedBy)
 */
export async function ssdLetterScopeFilter(userId: string): Promise<object> {
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      userRoles: { where: { appId: null }, select: { role: { select: { name: true } } }, take: 1 },
    },
  });

  if (dbUser?.userRoles[0]?.role.name === "superadmin") return {};

  if (await isSsdApprover(userId)) return {};

  // Cek apakah user adalah SSD org admin
  const orgAdmin = await db.ssdOrgAdmin.findUnique({
    where: { userId },
    select: { organizationId: true },
  });

  if (orgAdmin) return { organizationId: orgAdmin.organizationId };

  // Fallback: hanya surat sendiri
  return { requestedBy: userId };
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function toRoman(month: number): string {
  return ROMAN[month] ?? String(month);
}

export async function generateLetterNumber(
  categoryCode: string,
  companyCode: string,
  orgCode: string,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const counter = await db.ssdCounter.upsert({
    where: { categoryCode_companyCode_year: { categoryCode, companyCode, year } },
    create: { categoryCode, companyCode, year, seq: 1 },
    update: { seq: { increment: 1 } },
  });

  const seq = String(counter.seq).padStart(3, "0");
  return `${seq}/${categoryCode}-${companyCode}/${orgCode}/${toRoman(month)}/${year}`;
}


// ---------------------------------------------------------------------------------------------
// Akses surat & file (2026-11-18) — sebelumnya route detail/komentar/file hanya cek login. Semua
// aturan di bawah ditegakkan di SERVER pada setiap route (bukan hanya disembunyikan di UI).
// ---------------------------------------------------------------------------------------------

export const SSD_MAX_FILE_BYTES = 10 * 1024 * 1024; // sama dengan batas di formulir (10 MB)
export const SSD_ALLOWED_EXT = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp"];

const SSD_PATH_RE = /^ssd\/[A-Za-z0-9._-]+$/; // hanya folder ssd/, satu level, tanpa ".."
const isSafeSsdPath = (path: string) => SSD_PATH_RE.test(path) && !path.includes("..");

/** Nama file unggahan draft dibuat server & memuat id pengunggah → kepemilikan file yang belum tertaut ke surat bisa dicek. */
export const ssdDraftFilename = (userId: string, ext: string, now = new Date()) =>
  `draft-${userId}-${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;

/** File unggahan milik user ini (belum tentu tertaut ke surat). */
export const isOwnSsdUpload = (path: string, userId: string) => isSafeSsdPath(path) && path.startsWith(`ssd/draft-${userId}-`);

type Actor = { jobPositionId: string | null; organizationId: string | null; branchId: string | null };
const stepMatches = (s: { jobPositionId: string | null; organizationId: string | null; branchId: string | null }, me: Actor) =>
  (!s.jobPositionId || s.jobPositionId === me.jobPositionId) &&
  (!s.organizationId || s.organizationId === me.organizationId) &&
  (!s.branchId || s.branchId === me.branchId);

/**
 * Boleh membuka surat ini? = cakupan daftar (superadmin / approver template / org admin
 * organisasinya / pembuat) ATAU approver pada alur surat itu sendiri (template bisa berubah
 * sejak diajukan, jadi dicek juga lewat salinan langkah di approval surat).
 */
export async function canAccessSsdLetter(userId: string, letterId: string): Promise<boolean> {
  const scope = await ssdLetterScopeFilter(userId);
  const hit = await db.ssdLetter.findFirst({ where: { id: letterId, deletedAt: null, OR: [scope, { requestedBy: userId }] }, select: { id: true } });
  if (hit) return true;
  const letter = await db.ssdLetter.findFirst({ where: { id: letterId, deletedAt: null }, select: { id: true } });
  if (!letter) return false;
  const [me, approval] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { jobPositionId: true, organizationId: true, branchId: true } }),
    db.ssdApproval.findUnique({ where: { letterId }, include: { steps: true } }),
  ]);
  if (!me || !approval) return false;
  return approval.steps.some((s) => s.actorId === userId || (s.step === approval.currentStep && s.status === "PENDING" && stepMatches(s, me)));
}

/** Boleh MEMBACA file ini? File tertaut ke surat → ikut aturan akses surat; belum tertaut → hanya pengunggahnya. */
export async function canReadSsdFile(userId: string, path: string): Promise<boolean> {
  if (!isSafeSsdPath(path)) return false;
  const letters = await db.ssdLetter.findMany({ where: { OR: [{ fileDraft: path }, { fileFinal: path }] }, select: { id: true, deletedAt: true } });
  if (letters.length === 0) return isOwnSsdUpload(path, userId);
  for (const l of letters) if (!l.deletedAt && (await canAccessSsdLetter(userId, l.id))) return true;
  return false;
}

/** Boleh MENGHAPUS file ini? File tertaut → hanya pembuat surat selagi Draft; belum tertaut → hanya pengunggahnya. */
export async function canDeleteSsdFile(userId: string, path: string): Promise<boolean> {
  if (!isSafeSsdPath(path)) return false;
  const letters = await db.ssdLetter.findMany({ where: { OR: [{ fileDraft: path }, { fileFinal: path }] }, select: { requestedBy: true, status: true, deletedAt: true, fileFinal: true } });
  if (letters.length === 0) return isOwnSsdUpload(path, userId);
  return letters.every((l) => !l.deletedAt && l.requestedBy === userId && l.status === "DRAFT" && l.fileFinal !== path);
}

/** fileDraft yang dikirim klien harus file unggahan user ini atau file yang memang sudah tertaut ke surat itu. */
export const isAcceptableDraftPath = (path: string, userId: string, currentPath?: string | null) =>
  !path || path === currentPath || isOwnSsdUpload(path, userId);
