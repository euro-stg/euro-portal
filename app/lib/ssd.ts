import db from "@/lib/db/db";

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

// Seed counters from ENV: SSD_INITIAL_COUNTERS=HO-DEI-2026:43,HO-EMI-2026:10
export async function seedCountersFromEnv(): Promise<void> {
  const raw = process.env.SSD_INITIAL_COUNTERS;
  if (!raw) return;

  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const [key, valStr] = entry.split(":");
    const seq = parseInt(valStr ?? "0", 10);
    if (!key || isNaN(seq)) continue;

    const parts = key.split("-");
    if (parts.length < 3) continue;

    // key format: {categoryCode}-{companyCode}-{year}
    // e.g. HO-DEI-2026 → categoryCode=HO, companyCode=DEI, year=2026
    const year = parseInt(parts[parts.length - 1], 10);
    const companyCode = parts[parts.length - 2];
    const categoryCode = parts.slice(0, parts.length - 2).join("-");

    if (isNaN(year)) continue;

    await db.ssdCounter.upsert({
      where: { categoryCode_companyCode_year: { categoryCode, companyCode, year } },
      create: { categoryCode, companyCode, year, seq },
      update: { seq },
    });
  }
}
