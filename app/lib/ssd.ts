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
 *   - regular user with organizationId → own org's letters + own letters + letters they've acted on
 *   - regular user without organizationId → own letters + letters they've acted on
 *
 * Uses template-based check (stable) instead of real-time pending check,
 * so scope doesn't change after user acts on a letter.
 */
export async function ssdLetterScopeFilter(userId: string): Promise<object> {
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      userRoles: { where: { appId: null }, select: { role: { select: { name: true } } }, take: 1 },
    },
  });

  if (dbUser?.userRoles[0]?.role.name === "superadmin") return {};

  if (await isSsdApprover(userId)) return {};

  // Non-approver: own org + own letters + any letter they've been an actor on
  const acted = { approval: { steps: { some: { actorId: userId } } } };
  return dbUser?.organizationId
    ? { OR: [{ requestedBy: userId }, { requester: { organizationId: dbUser.organizationId } }, acted] }
    : { OR: [{ requestedBy: userId }, acted] };
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function toRoman(month: number): string {
  return ROMAN[month] ?? String(month);
}

export async function generateLetterNumber(
  categoryCode: string,
  companyCode: string,
  departmentCode: string,
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
  return `${seq}/${categoryCode}-${companyCode}/${departmentCode}/${toRoman(month)}/${year}`;
}

