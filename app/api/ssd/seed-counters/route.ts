import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { seedCountersFromEnv } from "@/lib/ssd";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await seedCountersFromEnv();
    return NextResponse.json({ message: "Counter berhasil diseed dari ENV" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
