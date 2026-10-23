import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import { buildUserListWhere, calcAge } from "@/lib/user-query";

// Export data user ke Excel (2026-10-23) — mengikuti filter yang sama dengan daftar user
// (lihat buildUserListWhere), tanpa Role. Berisi data pribadi (KTP, alamat, dll.) sesuai
// keputusan user, jadi HANYA untuk yang punya menu User — beda dengan /api/user/list yang
// cukup login karena dipakai pemilih user di halaman lain dan cuma berisi field dasar.
const COLUMNS: [string, (u: Row) => string | number | null][] = [
  ["Employee ID", (u) => u.employeeId],
  ["Nama", (u) => u.name],
  ["Nama Belakang", (u) => u.lastName],
  ["Email", (u) => u.email],
  ["No. Telepon", (u) => u.phone],
  ["No. HP", (u) => u.mobilePhone],
  ["Jenis Kelamin", (u) => u.gender],
  ["Tempat Lahir", (u) => u.birthPlace],
  ["Tanggal Lahir", (u) => day(u.birthDate)],
  ["Umur", (u) => calcAge(u.birthDate)],
  ["Agama", (u) => u.religion],
  ["Golongan Darah", (u) => u.bloodType],
  ["Status Pernikahan", (u) => u.maritalStatus],
  ["Jenis Identitas", (u) => u.identityType],
  ["No. Identitas", (u) => u.identityNumber],
  ["Alamat", (u) => u.address],
  ["Organisasi", (u) => u.organizationName],
  ["Jabatan", (u) => u.jobPositionName],
  ["Level Jabatan", (u) => u.jobLevel],
  ["Cabang", (u) => u.branchName],
  ["Status Kepegawaian", (u) => u.employmentStatus],
  ["Tanggal Bergabung", (u) => day(u.joinDate)],
  ["Tanggal Resign", (u) => day(u.resignDate)],
  ["Status", (u) => u.status],
  ["Source", (u) => (u.source === "manual" ? "Manual" : "Talenta")],
];

const SELECT = {
  employeeId: true, name: true, lastName: true, email: true, phone: true, mobilePhone: true,
  gender: true, birthPlace: true, birthDate: true, religion: true, bloodType: true, maritalStatus: true,
  identityType: true, identityNumber: true, address: true, organizationName: true, jobPositionName: true,
  jobLevel: true, branchName: true, employmentStatus: true, joinDate: true, resignDate: true,
  status: true, source: true,
} as const;
type Row = Awaited<ReturnType<typeof fetchRows>>[number];

const fetchRows = (where: ReturnType<typeof buildUserListWhere>) =>
  prisma.user.findMany({ where, select: SELECT, orderBy: { name: "asc" } });

// Tanggal disimpan sebagai tanggal (00:00 UTC) — tulis apa adanya sebagai YYYY-MM-DD.
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.user]))) return forbidden();

    const rows = await fetchRows(buildUserListWhere(new URL(request.url).searchParams));
    const sheet = XLSX.utils.aoa_to_sheet([COLUMNS.map(([h]) => h), ...rows.map((u) => COLUMNS.map(([, get]) => get(u) ?? ""))]);
    sheet["!cols"] = COLUMNS.map(([h]) => ({ wch: Math.max(12, h.length + 2) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Users");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=data-user-${stamp}.xlsx`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
