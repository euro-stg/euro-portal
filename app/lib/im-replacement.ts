import db from "@/lib/db/db";
import { canViewFile, relocateExpiredFiles } from "@/lib/edoc";

// Penggantian IM (2026-11-05) — lihat catatan model EDocFileReplacement di schema.prisma.
//   - Tautan dibuat saat upload IM baru atau di detail IM baru selama belum Release
//     (sesudah Release hanya superadmin). IM lama harus IM Release yang belum digantikan.
//   - Saat IM baru di-approve → applyReplacements(): IM lama berakhir H-1 dari Start Date IM
//     baru (atau dari tanggal approve kalau Start Date kosong), jadi Temporer, folder Obsolete
//     diisi kalau dipilih. End date tidak pernah dimundurkan.

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
export type ReplacementInput = { oldFileId: string; obsoleteFolderId: string | null };

const DAY = 86_400_000;
/** Tanggal (UTC 00:00, konvensi kolom tanggal E Document) hari ini di WIB. */
const todayDate = () => new Date(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
/** H-1 dari tanggal mulai IM baru (kolom tanggal disimpan sebagai UTC 00:00). */
export const endDateForReplacement = (newStartDate: Date | null) => new Date((newStartDate ?? todayDate()).getTime() - DAY);

/** Bersihkan input tautan dari client. */
export function parseReplacementInput(raw: unknown): ReplacementInput[] | { error: string } {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) return { error: "Data IM yang digantikan tidak valid" };
  const out = raw.map((x) => {
    const r = (x ?? {}) as { oldFileId?: unknown; obsoleteFolderId?: unknown };
    return { oldFileId: String(r.oldFileId ?? "").trim(), obsoleteFolderId: r.obsoleteFolderId ? String(r.obsoleteFolderId) : null };
  });
  if (out.some((r) => !r.oldFileId)) return { error: "IM yang digantikan tidak valid" };
  if (new Set(out.map((r) => r.oldFileId)).size !== out.length) return { error: "IM yang sama dipilih lebih dari sekali" };
  return out;
}

/**
 * Validasi tautan untuk IM baru (`newFileId` null = IM yang sedang diupload). Return pesan
 * error atau null. Tidak menulis apa pun.
 */
export async function validateReplacements(newFileId: string | null, links: ReplacementInput[]): Promise<string | null> {
  for (const l of links) {
    if (l.oldFileId === newFileId) return "IM tidak bisa menggantikan dirinya sendiri";
    const old = await db.eDocFile.findFirst({
      where: { id: l.oldFileId, deletedAt: null },
      select: { id: true, title: true, documentNumber: true, status: true, folderId: true, category: { select: { code: true } }, replacedBy: { select: { newFileId: true } } },
    });
    if (!old) return "IM yang digantikan tidak ditemukan";
    const label = old.documentNumber ?? old.title;
    if (old.category.code !== "IM") return `${label} bukan dokumen IM`;
    if (old.status !== "RELEASE") return `${label} belum Release — hanya IM yang sudah Release yang bisa digantikan`;
    if (old.replacedBy && old.replacedBy.newFileId !== newFileId) return `${label} sudah digantikan oleh IM lain`;
    if (old.replacedBy && old.replacedBy.newFileId === newFileId) return `${label} sudah ditautkan ke IM ini`;
    if (newFileId) {
      const inverse = await db.eDocFileReplacement.findFirst({ where: { newFileId: old.id, oldFileId: newFileId } });
      if (inverse) return `${label} justru menggantikan IM ini — tautan terbalik tidak bisa dibuat`;
    }
    if (l.obsoleteFolderId) {
      const f = await db.eDocFolder.findFirst({ where: { id: l.obsoleteFolderId, deletedAt: null }, select: { type: true, parentFolderId: true } });
      if (!f || f.type !== "OBSOLETE" || f.parentFolderId !== old.folderId) return `Folder Obsolete untuk ${label} tidak valid`;
    }
  }
  return null;
}

export function createReplacements(tx: Tx, newFileId: string, links: ReplacementInput[], userId: string) {
  return tx.eDocFileReplacement.createMany({
    data: links.map((l) => ({ newFileId, oldFileId: l.oldFileId, obsoleteFolderId: l.obsoleteFolderId, createdBy: userId })),
  });
}

/** Dipanggil di transaksi approve IM baru — akhiri semua IM lama yang digantikannya. */
export async function applyReplacements(tx: Tx, newFile: { id: string; startDate: Date | null }) {
  const reps = await tx.eDocFileReplacement.findMany({ where: { newFileId: newFile.id, appliedAt: null }, include: { oldFile: true } });
  const target = endDateForReplacement(newFile.startDate);
  for (const r of reps) {
    const old = r.oldFile;
    if (old.deletedAt) continue;
    const keepEnd = old.endDate && old.endDate <= target; // tidak pernah dimundurkan
    const endDate = keepEnd ? old.endDate! : target;
    const obsolete = r.obsoleteFolderId ?? old.obsoleteDestinationFolderId;
    await tx.eDocFile.update({
      where: { id: old.id },
      data: { endDate, validityType: "TEMPORER", obsoleteDestinationFolderId: obsolete },
    });
    await tx.eDocFileReplacement.update({
      where: { id: r.id },
      data: {
        appliedAt: new Date(), appliedEndDate: endDate,
        previousEndDate: old.endDate, previousValidityType: old.validityType, previousObsoleteFolderId: old.obsoleteDestinationFolderId,
      },
    });
  }
  return reps.length;
}

/** Setelah approve: pindahkan yang sudah berakhir ke folder Obsolete-nya (mekanisme lama). */
export const relocateAfterApply = () => relocateExpiredFiles().catch((e) => console.error("[edoc] relocate gagal:", e));

// ── Tampilan ──────────────────────────────────────────────────────────────────────────────
const summarySelect = { id: true, title: true, documentNumber: true, status: true, startDate: true, endDate: true, folderId: true, uploadedBy: true } as const;
type FileLite = { id: string; title: string; documentNumber: string | null; status: string; startDate: Date | null; endDate: Date | null; folderId: string; uploadedBy: string };

async function summarize(userId: string, f: FileLite) {
  const canOpen = await canViewFile(userId, f);
  // Tanpa akses: nomor saja (judul pun disembunyikan).
  return { id: f.id, documentNumber: f.documentNumber, title: canOpen ? f.title : null, status: f.status, startDate: f.startDate, endDate: f.endDate, canOpen };
}

export async function getReplacementInfo(userId: string, fileId: string) {
  const [replaces, replacedBy] = await Promise.all([
    db.eDocFileReplacement.findMany({ where: { newFileId: fileId, oldFile: { deletedAt: null } }, include: { oldFile: { select: summarySelect } }, orderBy: { createdAt: "asc" } }),
    db.eDocFileReplacement.findFirst({ where: { oldFileId: fileId, newFile: { deletedAt: null } }, include: { newFile: { select: summarySelect } } }),
  ]);
  const folderIds = replaces.map((r) => r.obsoleteFolderId).filter((x): x is string => !!x);
  const folders = new Map((await db.eDocFolder.findMany({ where: { id: { in: folderIds } }, select: { id: true, name: true } })).map((f) => [f.id, f.name]));
  return {
    replaces: await Promise.all(replaces.map(async (r) => ({
      oldFileId: r.oldFileId, file: await summarize(userId, r.oldFile), obsoleteFolderName: r.obsoleteFolderId ? folders.get(r.obsoleteFolderId) ?? null : null,
      appliedAt: r.appliedAt, appliedEndDate: r.appliedEndDate, previousEndDate: r.previousEndDate,
    }))),
    replacedBy: replacedBy ? { file: await summarize(userId, replacedBy.newFile), appliedAt: replacedBy.appliedAt, appliedEndDate: replacedBy.appliedEndDate } : null,
  };
}

/** Kandidat IM lama: IM Release yang belum digantikan & bisa dilihat user ini. */
export async function searchReplaceCandidates(userId: string, q: string, excludeFileId: string | null) {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await db.eDocFile.findMany({
    where: {
      deletedAt: null, status: "RELEASE", category: { code: "IM" }, replacedBy: null,
      ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
      OR: [{ documentNumber: { contains: term, mode: "insensitive" } }, { title: { contains: term, mode: "insensitive" } }],
    },
    select: { ...summarySelect, obsoleteDestinationFolderId: true },
    orderBy: { approvedAt: "desc" }, take: 40,
  });
  const visible = [];
  for (const r of rows) {
    if (visible.length >= 15) break;
    if (await canViewFile(userId, r)) visible.push(r);
  }
  // Pilihan folder Obsolete per IM lama = sub-folder Obsolete dari folder IM lama itu (sama
  // dengan pilihan folder Obsolete di form upload). Hanya id & nama.
  const parentIds = [...new Set(visible.map((r) => r.folderId))];
  const obs = await db.eDocFolder.findMany({ where: { parentFolderId: { in: parentIds }, deletedAt: null, type: "OBSOLETE" }, select: { id: true, name: true, parentFolderId: true }, orderBy: { name: "asc" } });
  return visible.map((r) => ({
    id: r.id, title: r.title, documentNumber: r.documentNumber, startDate: r.startDate, endDate: r.endDate,
    currentObsoleteFolderId: r.obsoleteDestinationFolderId,
    obsoleteFolders: obs.filter((o) => o.parentFolderId === r.folderId).map((o) => ({ id: o.id, name: o.name })),
  }));
}
