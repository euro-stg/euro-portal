import { SignJWT, jwtVerify } from "jose";

export const SSO_PERMISSIONS = ["LOGIN", "VALIDATE", "GET_USERS", "GET_BRANCHES", "GET_JOB_POSITIONS", "GET_COMPANIES", "GET_ORGANIZATIONS", "GET_ROLES"] as const;
export type SsoPermission = typeof SSO_PERMISSIONS[number];

export type AppTokenClaims = {
  sub: string;        // appTokenId
  name: string;       // app name snapshot
  permissions: string[];
};

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

export async function signAppTokenJwt(claims: AppTokenClaims): Promise<string> {
  return new SignJWT({ name: claims.name, permissions: claims.permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .sign(secret());
}

export async function verifyAppTokenJwt(token: string): Promise<AppTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      !Array.isArray(payload.permissions)
    ) return null;
    return {
      sub: payload.sub,
      name: payload.name as string,
      permissions: payload.permissions as string[],
    };
  } catch {
    return null;
  }
}

export function hasPermission(permissions: string[], required: SsoPermission): boolean {
  return permissions.includes(required);
}
