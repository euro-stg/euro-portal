import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { isSuperadmin } from "@/lib/edoc";
import { getEdocBlastEmailEnabled, setEdocBlastEmailEnabled } from "@/lib/system-config";

// Toggle global "Blast Email" E Document — proteksi testing (matikan sementara supaya
// approve percobaan tidak nyasar email ke user asli). Superadmin-only, konsisten dengan
// master-data lain di E Document.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    return NextResponse.json({ enabled: await getEdocBlastEmailEnabled() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;
    if (!(await isSuperadmin(userId))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const enabled = !!(body as { enabled?: unknown })?.enabled;
    await setEdocBlastEmailEnabled(enabled, userId);
    return NextResponse.json({ enabled });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
