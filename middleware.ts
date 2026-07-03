import { NextRequest, NextResponse } from "next/server";

const REPLICA_WRITE_WHITELIST = [
  /^\/api\/auth\//,                // NextAuth — portal login/logout/session
  /^\/api\/sso\/login$/,           // SSO login untuk apps eksternal
  /^\/api\/sso\/validate$/,        // SSO token validation
  /^\/api\/sso\/generate-link$/,   // Redirect SSO — portal user ke apps eksternal
];

const WRITE_METHODS = ["POST", "PATCH", "PUT", "DELETE"];

export function middleware(req: NextRequest) {
  if ((process.env.ENV_MODE ?? "PRODUCTION") !== "REPLICA") return NextResponse.next();

  const { pathname } = req.nextUrl;
  const method = req.method;

  if (!WRITE_METHODS.includes(method)) return NextResponse.next();

  const isWhitelisted = REPLICA_WRITE_WHITELIST.some((pattern) => pattern.test(pathname));
  if (isWhitelisted) return NextResponse.next();

  return NextResponse.json(
    {
      message: "Server ini berjalan dalam mode REPLICA — operasional apps dinonaktifkan.",
      mode: "REPLICA",
    },
    { status: 423 },
  );
}

export const config = {
  matcher: "/api/:path*",
};
