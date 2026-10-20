import db from "@/lib/db/db";
import { sendNotificationEmail } from "@/lib/mailer";
import { sseEmit } from "@/lib/sse-emitter";
import { matchCriteriaUsers } from "@/lib/edoc";
import { getNotifConfig } from "@/lib/system-config";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EMAIL_CONCURRENCY = 5;

/**
 * Blast notifikasi untuk satu post Euro Update (2026-10-15). Dikirim hanya kalau post sudah
 * publish, punya minimal satu kanal (notifyInApp / notifyEmail), dan BELUM pernah dikirim
 * (notifiedAt null) — jadi aman dipanggil setiap kali post dibuat/diubah. Penerima = user aktif
 * yang cocok salah satu kriteria (OR), sama dengan Kriteria Email Blast E Document; kalau semua
 * kriteria kosong → SEMUA user aktif (2026-10-20). Penulis post sendiri tidak ikut. Tidak pernah throw: gagal kirim tidak boleh menggagalkan
 * penyimpanan post. `origin` = base URL portal untuk link di email.
 */
export async function sendEuPostNotification(postId: string, origin: string): Promise<void> {
  try {
    const post = await db.euPost.findFirst({
      where: { id: postId, deletedAt: null },
      include: { category: { select: { name: true } } },
    });
    if (!post || !post.publishedAt || post.notifiedAt) return;
    if (!post.notifyInApp && !post.notifyEmail) return;

    const criteria = {
      branchIds: post.notifyBranchIds, orgIds: post.notifyOrgIds,
      positionIds: post.notifyPositionIds, businessUnitCodes: post.notifyBusinessUnitCodes,
    };
    // Kanal efektif = pilihan penulis post DAN saklar global notifikasi (menu Pengaturan
    // Notifikasi) — sama seperti notifikasi portal lainnya.
    const config = await getNotifConfig();
    const sendInApp = post.notifyInApp && config.inapp;
    const sendEmail = post.notifyEmail && config.email;
    const noCriteria = Object.values(criteria).every((v) => v.length === 0);
    const recipients = sendInApp || sendEmail
      ? (noCriteria
          ? await db.user.findMany({ where: { status: "active" }, select: { id: true, email: true } })
          : await matchCriteriaUsers(criteria, { requireEmail: false })
        ).filter((u) => u.id !== post.authorId)
      : [];

    // Tandai terkirim DULU (klaim atomik) supaya dua request bersamaan tidak mengirim dobel.
    // Tetap ditandai walau 0 penerima (mis. kanal dimatikan global) supaya tidak terkirim
    // belakangan secara tak terduga saat saklar global dinyalakan lagi.
    const claimed = await db.euPost.updateMany({
      where: { id: postId, notifiedAt: null },
      data: { notifiedAt: new Date(), notifiedCount: recipients.length },
    });
    if (claimed.count === 0 || recipients.length === 0) return;

    const title = `${post.category?.name ?? "Euro Update"}: ${post.title}`;
    const excerpt = post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    const refUrl = `/apps/euro-update?post=${post.id}`;

    if (sendInApp) {
      await db.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id, title, body: excerpt, type: "GENERAL", refId: post.id, appType: "EU", refUrl,
        })),
      });
      recipients.forEach((u) => sseEmit(u.id, { type: "notification" }));
    }

    if (sendEmail) {
      const body = `${escapeHtml(excerpt)}${excerpt.length >= 160 ? "…" : ""}<br/><br/>` +
        `<a href="${origin}${refUrl}" style="color:#2563eb;">Buka di EuroPortal</a>`;
      // Penerima bisa ribuan (kriteria kosong = semua karyawan) dan tiap email membuka koneksi
      // SMTP sendiri — kirim di background, maks. EMAIL_CONCURRENCY sekaligus, supaya server
      // email tidak menolak/memblokir. sendNotificationEmail tidak pernah throw (gagal → EmailLog).
      const emails = recipients.map((u) => u.email).filter((e): e is string => !!e);
      void (async () => {
        for (let i = 0; i < emails.length; i += EMAIL_CONCURRENCY) {
          await Promise.all(emails.slice(i, i + EMAIL_CONCURRENCY)
            .map((to) => sendNotificationEmail(to, escapeHtml(title), body, "Euro Update")));
        }
      })();
    }
  } catch (e) {
    console.error("[eu] gagal mengirim notifikasi post", e);
  }
}

/** Ambil & validasi field notifikasi dari body request (POST/PATCH /api/eu/post). */
export function parseEuNotifyInput(body: Record<string, unknown>) {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : undefined);
  const data = {
    ...(body.notifyInApp !== undefined && { notifyInApp: Boolean(body.notifyInApp) }),
    ...(body.notifyEmail !== undefined && { notifyEmail: Boolean(body.notifyEmail) }),
    ...(list(body.notifyBranchIds) && { notifyBranchIds: list(body.notifyBranchIds) }),
    ...(list(body.notifyOrgIds) && { notifyOrgIds: list(body.notifyOrgIds) }),
    ...(list(body.notifyPositionIds) && { notifyPositionIds: list(body.notifyPositionIds) }),
    ...(list(body.notifyBusinessUnitCodes) && { notifyBusinessUnitCodes: list(body.notifyBusinessUnitCodes) }),
  };
  // Kriteria kosong tidak lagi ditolak — artinya dikirim ke semua user aktif.
  return { data, error: null as string | null };
}
