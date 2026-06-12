import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const BASE_URL = "https://api.mekari.com";

/* =========================
   ✅ TYPE
========================= */
type TalentaEmployee = {
  employee_id: string;
  first_name: string | null;
  join_date: string | null;
  resign_date: string | null;
  organization_id: number | null;
  organization_name: string | null;
  job_position_id: number | null;
  branch_id: number | null;
  branch: string | null;
  phone: string | null;
  email: string | null;
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
export async function POST() {
  try {
    console.log("🔥 START SYNC TALENTA");

    /* ✅ load job position */
    const jobPositionMap = await fetchJobPositions();

    /* ✅ password */
    const rawPassword = process.env.USER_PASSWORD || "123456";
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    /* ✅ first page */
    const firstPage = await fetchEmployees(1);
    const totalPage = firstPage.pagination.last_page;

    let processed = 0;
    let created = 0;
    let updated = 0;

    for (let page = 1; page <= totalPage; page++) {
      console.log(`📄 PAGE ${page}/${totalPage}`);

      const data =
        page === 1 ? firstPage : await fetchEmployees(page);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const emp of data.employees) {
        if (!emp.employee_id) continue;

        const existing = await prisma.user.findUnique({
          where: { employeeId: emp.employee_id },
        });

        // Jika sudah resign
        if (emp.resign_date) {
          const resignEffective = new Date(emp.resign_date);
          resignEffective.setHours(0, 0, 0, 0);
          const isEffective = resignEffective <= today;

          if (existing) {
            // Update resign date dan nonaktifkan jika tanggal efektif sudah lewat
            await prisma.user.update({
              where: { employeeId: emp.employee_id },
              data: {
                resignDate: new Date(emp.resign_date),
                status: isEffective ? "inactive" : existing.status ?? "active",
              },
            });
            updated++;
            processed++;
          }
          // Jika belum ada di DB dan sudah resign, skip
          continue;
        }

        const payload = {
          employeeId: emp.employee_id,
          name: emp.first_name ?? null,
          joinDate: emp.join_date ? new Date(emp.join_date) : null,
          resignDate: null,
          organizationId: emp.organization_id ? String(emp.organization_id) : null,
          organizationName: emp.organization_name ?? null,
          branchId: emp.branch_id ? String(emp.branch_id) : null,
          branchName: emp.branch ?? null,
          jobPositionId: emp.job_position_id ? String(emp.job_position_id) : null,
          jobPositionName: emp.job_position_id ? jobPositionMap[String(emp.job_position_id)] ?? null : null,
          phone: emp.phone ?? null,
          email: emp.email ?? null,
          status: "active",
        };

        if (!payload.jobPositionName) {
          console.log("⚠️ Missing job name:", emp.job_position_id);
        }

        if (!existing) {
          await prisma.user.create({ data: { ...payload, password: hashedPassword } });
          created++;
        } else {
          await prisma.user.update({ where: { employeeId: emp.employee_id }, data: payload });
          updated++;
        }

        processed++;
        if (processed % 100 === 0) console.log(`✅ Processed: ${processed}`);
      }
    }

    console.log("✅ SYNC DONE");

    return NextResponse.json({
      success: true,
      message: "✅ Sync Talenta berhasil",
      processed,
      created,
      updated,
    });
  } catch (error: unknown) {
    console.error("❌ SYNC ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}