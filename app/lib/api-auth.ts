import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export const unauthorized = () =>
  NextResponse.json({ message: "Unauthorized" }, { status: 401 });
