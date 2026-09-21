import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { isSuperadmin, generateImPricelistTemplate } from "@/lib/edoc";

// Template import Master Pricelist — sheet "Pricelist" pre-filled dengan data yang sudah
// ada (kalau ada), supaya admin tinggal edit/tambah baris lalu upload ulang.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const buffer = await generateImPricelistTemplate();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=Template Master Pricelist.xlsx",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
