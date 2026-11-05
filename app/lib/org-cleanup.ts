import db from "@/lib/db/db";

// Bersihkan org sampah (2026-11-05), dipanggil dari Sync organisasi: org yang punya karyawan
// tapi tidak satu pun masih aktif dengan resign date kosong → soft delete. Org tanpa karyawan
// sama sekali (mis. dibuat manual) tidak disentuh. Dilewati kalau masih punya sub-org aktif atau
// masih dipakai (template approval, admin SSD, default org role, E Document) — hapus manual
// setelah referensinya diganti. Return id org yang dihapus.
export async function removeResignedOrgs(): Promise<string[]> {
  const activeOrgIds = new Set((await db.user.groupBy({
    by: ["organizationId"], where: { status: "active", resignDate: null, organizationId: { not: null } },
  })).map((g) => g.organizationId!));
  const withUsers = await db.user.groupBy({ by: ["organizationId"], where: { organizationId: { not: null } } });
  const candidates = new Set(
    withUsers.map((g) => g.organizationId!).filter((id) => !activeOrgIds.has(id)),
  );
  if (candidates.size > 0) {
    const ids = [...candidates];
    const [sdSteps, ssdSteps, ssdAdmins, roles, files] = await Promise.all([
      db.sdApprovalTemplateStep.findMany({ where: { organizationId: { in: ids } }, select: { organizationId: true } }),
      db.ssdApprovalTemplateStep.findMany({ where: { organizationId: { in: ids } }, select: { organizationId: true } }),
      db.ssdOrgAdmin.findMany({ where: { organizationId: { in: ids } }, select: { organizationId: true } }),
      db.role.findMany({ where: { defaultOrgId: { in: ids } }, select: { defaultOrgId: true } }),
      db.eDocFile.findMany({ where: { organizationId: { in: ids }, deletedAt: null }, select: { organizationId: true } }),
    ]);
    for (const r of [...sdSteps, ...ssdSteps, ...ssdAdmins, ...files]) if (r.organizationId) candidates.delete(r.organizationId);
    for (const r of roles) if (r.defaultOrgId) candidates.delete(r.defaultOrgId);
  }
  const live = await db.organization.findMany({ where: { deletedAt: null }, select: { id: true, parentOrganizationId: true } });
  const liveIds = new Set(live.map((o) => o.id));
  const removed: string[] = [];
  // Dari bawah ke atas: org induk baru bisa dihapus setelah semua sub-org-nya terhapus.
  for (let grew = true; grew; ) {
    grew = false;
    for (const o of live) {
      if (!candidates.has(o.id) || !liveIds.has(o.id)) continue;
      if (live.some((c) => c.parentOrganizationId === o.id && liveIds.has(c.id))) continue;
      liveIds.delete(o.id);
      removed.push(o.id);
      grew = true;
    }
  }
  if (removed.length > 0) {
    await db.organization.updateMany({ where: { id: { in: removed } }, data: { deletedAt: new Date() } });
  }
  return removed;
}
