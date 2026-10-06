import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { seedTree } from "@/server/seed";

export const INVITE_COOKIE = "libelluz_invite";

export const isAdminEmail = (email?: string | null) =>
  !!email && !!process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

export const googleEnabled = () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Sem AUTH_SECRET definido, derivamos um segredo estável do DATABASE_URL (que já é secreto).
function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const base = process.env.DATABASE_URL ?? "libelluz-dev";
  return createHash("sha256").update(`libelluz-auth:${base}`).digest("hex");
}

export async function findUsableInvite(code: string) {
  const db = getDb();
  return db.query.invites.findFirst({
    where: (i, { and, eq, isNull }) => and(eq(i.code, code.trim().toUpperCase()), isNull(i.usedBy)),
  });
}

export async function consumeInvite(code: string, userId: string) {
  await getDb()
    .update(schema.invites)
    .set({ usedBy: userId, usedAt: new Date() })
    .where(and(eq(schema.invites.code, code.trim().toUpperCase()), isNull(schema.invites.usedBy)));
}

function config(): NextAuthConfig {
  const db = getDb();
  return {
    secret: secret(),
    trustHost: true,
    session: { strategy: "jwt" },
    pages: { signIn: "/entrar" },
    adapter: DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
    providers: [
      ...(googleEnabled() ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(c) {
          const email = String(c?.email ?? "").trim().toLowerCase();
          const password = String(c?.password ?? "");
          if (!email || !password) return null;
          const u = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
          if (!u?.passwordHash || !(await bcrypt.compare(password, u.passwordHash))) return null;
          return { id: u.id, name: u.name, email: u.email, image: u.image };
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider !== "google") return true;
        const email = user.email?.toLowerCase();
        if (!email) return false;
        const existing = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
        if (existing || isAdminEmail(email)) return true;
        const code = (await cookies()).get(INVITE_COOKIE)?.value;
        if (code && (await findUsableInvite(code))) return true;
        return "/cadastro?erro=convite";
      },
      jwt({ token, user }) {
        if (user?.id) token.sub = user.id;
        return token;
      },
      session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        return session;
      },
    },
    events: {
      // Só dispara para contas criadas pelo Google (o cadastro por e-mail cuida disso sozinho).
      async createUser({ user }) {
        if (!user.id) return;
        const jar = await cookies();
        const code = jar.get(INVITE_COOKIE)?.value;
        if (code) {
          await consumeInvite(code, user.id);
          jar.delete(INVITE_COOKIE);
        }
        await seedTree(user.id);
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => config());
