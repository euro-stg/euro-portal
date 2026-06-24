import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export const maxDuration = 300; // 5 menit

const BASE_URL = "https://api.mekari.com";

/* =========================
   ✅ TYPE
========================= */
type TalentaEmployee = {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  join_date: string | null;
  resign_date: string | null;
  organization_id: number | null;
  organization_name: string | null;
  job_position_id: number | null;
  job_level: string | null;
  employment_status: string | null;
  branch_id: number | null;
  branch: string | null;
  phone: string | null;
  mobile_phone: string | null;
  email: string | null;
  avatar: string | null;
  gender: string | null;
  birth_place: string | null;
  birth_date: string | null;
  address: string | null;
  religion: string | null;
  blood_type: string | null;
  marital_status: string | null;
  identity_type: string | null;
  identity_number: string | null;
};

type TalentaEmployeeResponse = {
  employees: TalentaEmployee[];
  pagination: {
    current_page: number;
    last_page: number;
  };
};

type TalentaJobPosition = {
  id: number;
  name: string;
};

type TalentaJobPositionResponse = {
  job_position: TalentaJobPosition[];
  pagination: {
    current_page: number;
    last_page: number;
  };
};

/* =========================
   ✅ HMAC
========================= */
function generateHmacHeader(path: string) {
  const username = process.env.HMAC_USERNAME_TALENTA!;
  const secret = process.env.HMAC_SECRET!;

  const date = new Date().toUTCString();
  const requestLine = `GET ${path} HTTP/1.1`;
  const message = `date: ${date}\n${requestLine}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("base64");

  const authHeader = `hmac username="${username}", algorithm="hmac-sha256", headers="date request-line", signature="${signature}"`;

  return { authHeader, date };
}

/* =========================
   ✅ AVATAR HELPERS
========================= */

// Extract path dari URL Talenta tanpa query params → identifier perubahan
function extractImageKey(avatarUrl: string): string | null {
  try {
    const url = new URL(avatarUrl);
    return decodeURIComponent(url.pathname.slice(1)); // "avatar/filename.jpg"
  } catch {
    return null;
  }
}

// Hash dari imageKey → filename tidak bisa ditebak dari employeeId
function imageKeyToFilename(imageKey: string): string {
  return crypto.createHash("sha256").update(imageKey).digest("hex").slice(0, 32) + ".jpg";
}

// Hapus file lokal lama jika ada (saat avatar berubah)
async function deleteLocalAvatar(oldImageUrl: string | null) {
  if (!oldImageUrl?.startsWith("/api/files/talenta/")) return;
  const filename = oldImageUrl.split("/").pop();
  if (!filename) return;
  const filePath = path.join(process.cwd(), "uploads", "talenta", filename);
  await unlink(filePath).catch(() => null); // abaikan jika file tidak ada
}

// Download avatar dari Talenta, simpan ke uploads/talenta/{hash}.jpg
async function downloadAvatar(avatarUrl: string, imageKey: string): Promise<string | null> {
  try {
    const res = await fetch(avatarUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.join(process.cwd(), "uploads", "talenta");
    await mkdir(dir, { recursive: true });
    const filename = imageKeyToFilename(imageKey);
    await writeFile(path.join(dir, filename), buffer);
    return `/api/files/talenta/${filename}`;
  } catch {
    return null;
  }
}

/* =========================
   ✅ FETCH EMPLOYEE
========================= */
async function fetchEmployees(
  page: number,
): Promise<TalentaEmployeeResponse> {
  const path = `/v2/talenta/v3/employees?limit=1000&page=${page}`;

  const { authHeader, date } = generateHmacHeader(path);

  const res = await fetch(BASE_URL + path, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Date: date,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ Employee API ERROR:", text);
    throw new Error(text);
  }

  const json: { data: TalentaEmployeeResponse } = JSON.parse(text);

  return json.data;
}

/* =========================
   ✅ FETCH JOB POSITION (ALL PAGE)
========================= */
async function fetchJobPositions(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  // ✅ ambil page pertama
  const firstPath = `/v2/talenta/v2/company/33683/job-position?limit=1000&page=1`;
  const { authHeader, date } = generateHmacHeader(firstPath);

  const firstRes = await fetch(BASE_URL + firstPath, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Date: date,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const firstText = await firstRes.text();

  if (!firstRes.ok) {
    console.error("❌ Job Position API ERROR:", firstText);
    throw new Error(firstText);
  }

  const firstJson: { data: TalentaJobPositionResponse } =
    JSON.parse(firstText);

  const totalPage = firstJson.data.pagination.last_page;

  console.log("📊 Job Position pages:", totalPage);

  // ✅ loop semua page
  for (let page = 1; page <= totalPage; page++) {
    const path = `/v2/talenta/v2/company/33683/job-position?limit=1000&page=${page}`;

    const { authHeader, date } = generateHmacHeader(path);

    const res = await fetch(BASE_URL + path, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Date: date,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("❌ Job Position API ERROR:", text);
      throw new Error(text);
    }

    const json: { data: TalentaJobPositionResponse } =
      JSON.parse(text);

    for (const pos of json.data.job_position) {
      map[String(pos.id)] = pos.name;
    }
  }

  console.log("✅ Job Position Loaded:", Object.keys(map).length);

  return map;
}

/* =========================
   ✅ MAIN SYNC
========================= */
const BATCH_SIZE = 20;

export async function POST(req: NextRequest) {
  // Izinkan dari session login (manual) atau SYNC_SECRET header (scheduled)
  const secret = req.headers.get("x-sync-secret");
  const isScheduled = secret && secret === process.env.SYNC_SECRET;

  if (!isScheduled) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const trigger = isScheduled ? "scheduled" : "manual";

  const log = await prisma.syncLog.create({
    data: { trigger, status: "running" },
  });

  try {
    console.log(`🔥 START SYNC TALENTA [${trigger}]`);

    const jobPositionMap = await fetchJobPositions();

    const firstPage = await fetchEmployees(1);
    const totalPage = firstPage.pagination.last_page;

    // Kumpulkan semua employee dari semua page dulu
    const allEmployees: TalentaEmployee[] = [...firstPage.employees];
    for (let page = 2; page <= totalPage; page++) {
      console.log(`📄 Fetch page ${page}/${totalPage}`);
      const data = await fetchEmployees(page);
      allEmployees.push(...data.employees);
    }

    console.log(`📊 Total employee dari Talenta: ${allEmployees.length}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ambil semua user yang sudah ada beserta talentaImageKey + image untuk cek/hapus avatar lama
    const existingUsers = new Map(
      (await prisma.user.findMany({ select: { employeeId: true, talentaImageKey: true, image: true } }))
        .map((u) => [u.employeeId, { talentaImageKey: u.talentaImageKey, image: u.image }]),
    );

    let processed = 0;
    let created = 0;
    let updated = 0;

    // Proses dalam batch paralel
    for (let i = 0; i < allEmployees.length; i += BATCH_SIZE) {
      const batch = allEmployees.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (emp) => {
          if (!emp.employee_id) return;

          const existingUser = existingUsers.get(emp.employee_id);
          const isExisting = !!existingUser;

          // Resign handling
          if (emp.resign_date) {
            const resignEffective = new Date(emp.resign_date);
            resignEffective.setHours(0, 0, 0, 0);
            const isEffective = resignEffective <= today;

            if (isExisting) {
              await prisma.user.update({
                where: { employeeId: emp.employee_id },
                data: {
                  resignDate: new Date(emp.resign_date),
                  status: isEffective ? "inactive" : "active",
                },
              });
              updated++;
              processed++;
            }
            return;
          }

          // Avatar: download ke lokal jika berubah, filename = hash(key) supaya tidak bisa ditebak
          const avatarUrl = emp.avatar?.trim() || null;
          const newImageKey = avatarUrl ? extractImageKey(avatarUrl) : null;
          const storedImageKey = existingUser?.talentaImageKey ?? null;
          const avatarChanged = newImageKey !== storedImageKey;

          let imageFields: { image?: string | null; talentaImageKey?: string | null } = {};

          if (!avatarUrl) {
            // Talenta tidak punya avatar → clear
            imageFields = { image: null, talentaImageKey: null };
            if (isExisting) await deleteLocalAvatar(existingUser!.image);
          } else if (newImageKey && (!isExisting || avatarChanged)) {
            // Avatar baru atau berubah → hapus lama, download baru
            if (isExisting && avatarChanged) await deleteLocalAvatar(existingUser!.image);
            const localUrl = await downloadAvatar(avatarUrl, newImageKey);
            imageFields = {
              image: localUrl ?? avatarUrl, // fallback ke Talenta URL jika download gagal
              talentaImageKey: newImageKey,
            };
          }
          // else: avatar tidak berubah → tidak update image fields

          const payload = {
            employeeId: emp.employee_id,
            name: emp.first_name ?? null,
            lastName: emp.last_name || null,
            joinDate: emp.join_date ? new Date(emp.join_date) : null,
            resignDate: null,
            organizationId: emp.organization_id ? String(emp.organization_id) : null,
            organizationName: emp.organization_name ?? null,
            branchId: emp.branch_id ? String(emp.branch_id) : null,
            branchName: emp.branch ?? null,
            jobPositionId: emp.job_position_id ? String(emp.job_position_id) : null,
            jobPositionName: emp.job_position_id ? jobPositionMap[String(emp.job_position_id)] ?? null : null,
            jobLevel: emp.job_level ?? null,
            employmentStatus: emp.employment_status ?? null,
            phone: emp.phone && emp.phone !== "0" ? emp.phone : null,
            mobilePhone: emp.mobile_phone && !emp.mobile_phone.includes("*") ? emp.mobile_phone : null,
            email: emp.email && !emp.email.includes("*") ? emp.email : null,
            gender: emp.gender ?? null,
            birthPlace: emp.birth_place ?? null,
            birthDate: emp.birth_date ? new Date(emp.birth_date) : null,
            address: emp.address ?? null,
            religion: emp.religion ?? null,
            bloodType: emp.blood_type ?? null,
            maritalStatus: emp.marital_status ?? null,
            identityType: emp.identity_type ?? null,
            identityNumber: emp.identity_number ?? null,
            status: "active",
            ...imageFields,
          };

          if (!isExisting) {
            const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 8);
            await prisma.user.create({ data: { ...payload, password: hashedPassword } });
            existingUsers.set(emp.employee_id, { talentaImageKey: newImageKey, image: imageFields.image ?? null });
            created++;
          } else {
            await prisma.user.update({ where: { employeeId: emp.employee_id }, data: payload });
            updated++;
          }

          processed++;
        }),
      );

      console.log(`✅ Processed: ${Math.min(i + BATCH_SIZE, allEmployees.length)}/${allEmployees.length}`);
    }

    console.log("✅ SYNC DONE");

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", processed, created, updated, finishedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "✅ Sync Talenta berhasil",
      processed,
      created,
      updated,
    });
  } catch (error: unknown) {
    console.error("❌ SYNC ERROR:", error);

    const errMsg = error instanceof Error ? error.message : "Unknown error";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "error", error: errMsg, finishedAt: new Date() },
    }).catch(() => null);

    return NextResponse.json({ success: false, message: errMsg }, { status: 500 });
  }
}