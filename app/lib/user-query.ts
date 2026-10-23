import type { Prisma } from "../../generated/prisma/client";

// Helper daftar user (2026-10-23) — dipakai bersama GET /api/user/list dan GET /api/user/export
// supaya hasil export selalu sama persis dengan yang tampil di tabel untuk filter yang sama.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Tanggal "hari ini" menurut WIB, sebagai komponen UTC (tahun/bulan/tanggal). */
function todayWib() {
  const d = new Date(Date.now() + WIB_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

/**
 * Umur dihitung dari tanggal lahir — kolom User.age tidak pernah diisi sync Talenta (selalu
 * null), jadi tidak dipakai lagi. Tanggal lahir disimpan sebagai tanggal (00:00 UTC), jadi
 * komponen UTC-nya yang dibaca.
 */
export function calcAge(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const t = todayWib();
  let age = t.y - b.getUTCFullYear();
  if (t.m < b.getUTCMonth() || (t.m === b.getUTCMonth() && t.d < b.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

/** Tanggal lahir paling akhir agar seseorang sudah berumur `age` tahun hari ini. */
function bornOnOrBefore(age: number) {
  const t = todayWib();
  return new Date(Date.UTC(t.y - age, t.m, t.d));
}

/** Filter umur "25" atau "25-30" → rentang tanggal lahir. */
function parseAgeFilter(raw: string | null): Prisma.DateTimeNullableFilter | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const [a, b] = v.includes("-") ? v.split("-").map((x) => Number(x.trim())) : [Number(v), Number(v)];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return undefined;
  const min = Math.min(a, b), max = Math.max(a, b);
  // umur >= min  ⇔ lahir <= hari ini − min tahun
  // umur <= max  ⇔ lahir >  hari ini − (max+1) tahun
  return { lte: bornOnOrBefore(min), gt: bornOnOrBefore(max + 1) };
}

function parseDateFilter(raw: string | null): Prisma.DateTimeNullableFilter | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const date = new Date(`${v}T00:00:00.000Z`);
  if (isNaN(date.getTime())) return undefined;
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return { gte: date, lt: next };
}

const contains = (v: string) => ({ contains: v, mode: "insensitive" as const });

/** Filter daftar user dari query string (name, employeeId, status, roleId, source, dll). */
export function buildUserListWhere(sp: URLSearchParams): Prisma.UserWhereInput {
  const get = (k: string) => sp.get(k)?.trim() || null;
  const name = get("name"), employeeId = get("employeeId"), status = get("status"), roleId = get("roleId");
  const source = get("source"), organizationName = get("organizationName");
  const jobPositionName = get("jobPositionName"), branchName = get("branchName");
  const birthDateFilter = parseAgeFilter(sp.get("age"));
  const joinDateFilter = parseDateFilter(sp.get("joinDate"));
  const resignDateFilter = parseDateFilter(sp.get("resignDate"));

  return {
    ...(name ? { name: contains(name) } : {}),
    ...(employeeId ? { employeeId: contains(employeeId) } : {}),
    ...(status ? { status: contains(status) } : {}),
    ...(roleId ? { userRoles: { some: { roleId } } } : {}),
    ...(source === "manual" ? { source: "manual" } : source === "talenta" ? { source: { not: "manual" } } : {}),
    ...(organizationName ? { organizationName: contains(organizationName) } : {}),
    ...(jobPositionName ? { jobPositionName: contains(jobPositionName) } : {}),
    ...(branchName ? { branchName: contains(branchName) } : {}),
    ...(birthDateFilter ? { birthDate: birthDateFilter } : {}),
    ...(joinDateFilter ? { joinDate: joinDateFilter } : {}),
    ...(resignDateFilter ? { resignDate: resignDateFilter } : {}),
  };
}
