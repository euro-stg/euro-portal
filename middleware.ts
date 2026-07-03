import { NextRequest, NextResponse } from "next/server";

const REPLICA_WRITE_WHITELIST = [
  /^\/api\/auth\//,                // NextAuth — portal login/logout/session
  /^\/api\/sso\/login$/,           // SSO login untuk apps eksternal
  /^\/api\/sso\/validate$/,        // SSO token validation
  /^\/api\/sso\/generate-link$/,   // Redirect SSO — portal user ke apps eksternal
];

const WRITE_METHODS = ["POST", "PATCH", "PUT", "DELETE"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Inject pathname ke request headers agar bisa dibaca server components (layout)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  // REPLICA: blokir semua write non-eksternal
  if ((process.env.ENV_MODE ?? "PRODUCTION") === "REPLICA") {
    if (WRITE_METHODS.includes(req.method)) {
      const isWhitelisted = REPLICA_WRITE_WHITELIST.some((pattern) => pattern.test(pathname));
      if (!isWhitelisted) {
        return NextResponse.json(
          {
            message: "Server ini berjalan dalam mode REPLICA — operasional apps dinonaktifkan.",
            mode: "REPLICA",
          },
          { status: 423 },
        );
      }
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
