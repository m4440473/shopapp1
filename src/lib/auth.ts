import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { compare } from 'bcryptjs';

const DEFAULT_ROLE = 'MACHINIST';

const resolveRole = (role?: string | null) => role ?? DEFAULT_ROLE;

const isAdminRole = (role?: string | null) => resolveRole(role) === 'ADMIN';

type PrismaUser = {
  id: string;
  email: string;
  name: string | null;
  role?: string | null;
};

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  admin?: boolean;
};

type SessionUserInput = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  admin?: boolean;
};

const buildAuthUser = (user: PrismaUser): SessionUser => ({
  id: user.id,
  email: user.email,
  name: user.name ?? '',
  role: resolveRole(user.role),
  admin: isAdminRole(user.role),
});

const applyUserToToken = (token: JWT, user: SessionUser) => {
  const role = resolveRole(user.role);
  const admin = user.admin ?? isAdminRole(role);
  return {
    ...token,
    role,
    admin,
    id: user.id ?? token.sub,
  };
};

const applyTokenToSessionUser = (sessionUser: SessionUserInput, token: JWT): SessionUser => {
  const tokenRole = (token as { role?: string }).role;
  const id = (token as { id?: string }).id ?? token.sub ?? sessionUser.id ?? '';
  return {
    ...sessionUser,
    role: tokenRole ?? DEFAULT_ROLE,
    admin: (token as { admin?: boolean }).admin ?? isAdminRole(tokenRole),
    id,
  };
};

const resolveAuthBaseUrl = (fallback: string) => {
  const envBase =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL;
  if (envBase && envBase.length > 0) {
    return envBase;
  }
  return fallback;
};

export const authOptions: NextAuthOptions & { trustHost?: boolean } = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/signin' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) {
          return null;
        }
        if (!user.active) {
          return null;
        }
        if (!user.passwordHash) {
          return null;
        }
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) {
          return null;
        }
        return buildAuthUser(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return applyUserToToken(token, user);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user = applyTokenToSessionUser(session.user, token);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const resolvedBaseUrl = resolveAuthBaseUrl(baseUrl);
      if (url.startsWith('/')) {
        return `${resolvedBaseUrl}${url}`;
      }
      try {
        const targetUrl = new URL(url);
        const allowedOrigin = new URL(resolvedBaseUrl).origin;
        if (targetUrl.origin === allowedOrigin) {
          return targetUrl.toString();
        }
      } catch {
        return resolvedBaseUrl;
      }
      return resolvedBaseUrl;
    },
  },
};
