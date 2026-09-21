import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { generateImProductTemplate } from "@/lib/edoc";

// Template Excel untuk import produk/promo Category IM: tab "Promo per Item" (kosong,
// siap diisi) + tab "Pricelist" (referensi, terisi LIVE dari Master Pricelist saat ini).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const buffer = await generateImProductTemplate();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=Template Promo per Item.xlsx",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
