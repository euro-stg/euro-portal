import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { encode as defaultEncode } from "next-auth/jwt";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";

import db from "@/lib/db/db";
import { signInSchema } from "@/lib/schema";
import { recordLogin } from "@/lib/login-log";

const adapter = PrismaAdapter(db);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter,

  providers: [
    Credentials({
      credentials: {
        employeeId: { type: "text" },
        password: { type: "password" },
      },

      authorize: async (credentials, request) => {
        if (!credentials) return null;

        const { employeeId, password } = signInSchema.parse(credentials);
        // Riwayat login (2026-11-11) — setiap hasil (berhasil/gagal) dicatat ke LoginLog.
        const log = (success: boolean, userId: string | null, reason?: string) =>
          recordLogin({ request, employeeId, userId, channel: "PORTAL", success, reason });

        const user = await db.user.findUnique({
          where: {
            employeeId: employeeId.toLowerCase(),
          },
        });

        if (!user || !user.password) {
          await log(false, user?.id ?? null, user ? "Password belum diatur" : "Employee ID tidak dikenal");
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          await log(false, user.id, "Password salah");
          return null;
        }

        // Cek resign date — jika sudah efektif, nonaktifkan dan tolak login
        if (user.resignDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const resignDay = new Date(user.resignDate);
          resignDay.setHours(0, 0, 0, 0);
          if (resignDay <= today) {
            await db.user.update({ where: { id: user.id }, data: { status: "inactive" } });
            await log(false, user.id, "Akun tidak aktif (resign)");
            return null;
          }
        }

        // Tolak user inactive
        if (user.status === "inactive") {
          await log(false, user.id, "Akun tidak aktif");
          return null;
        }

        await log(true, user.id);

        return {
          id: user.id,
          employeeId: user.employeeId,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
  },

  jwt: {
    encode: async (params) => {
      if (params.token?.credentials) {
        if (!adapter.createSession) {
          throw new Error("Adapter does not support sessions");
        }

        if (!params.token.sub) {
          throw new Error("No user ID found in token");
        }

        const sessionToken = uuid();

        await adapter.createSession({
          sessionToken,
          userId: params.token.sub,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        return sessionToken;
      }

      return defaultEncode(params);
    },
  },
});
