import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { queryOne } from "./db";

interface DbUser {
  id: string;
  email: string;
  nome: string;
  password_hash: string;
  role: string;
  tenant_id: string;
  ativo: boolean;
  tenant_nome: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await queryOne<DbUser>(
          `SELECT u.id, u.email, u.nome, u.password_hash, u.role, u.tenant_id, u.ativo,
                  t.nome as tenant_nome
           FROM users u
           JOIN tenants t ON t.id = u.tenant_id
           WHERE u.email = $1`,
          [credentials.email]
        );

        if (!user || !user.ativo) return null;

        const valid = await compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        // Update last login
        await queryOne("UPDATE users SET ultimo_login = NOW() WHERE id = $1", [
          user.id,
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.nome,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_nome,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.tenantName = (user as { tenantName: string }).tenantName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = session.user as any;
        user.role = token.role;
        user.tenantId = token.tenantId;
        user.tenantName = token.tenantName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
