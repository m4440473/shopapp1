import type { NextAuthOptions, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import type { User as PrismaUser } from '@prisma/client';
import { prisma } from './prisma';
import { compare } from 'bcryptjs';

const DEFAULT_ROLE = 'MACHINIST';

const resolveRole = (role?: string | null) => role ?? DEFAULT_ROLE;

const isAdminRole = (role?: string | null) => resolveRole(role) === 'ADMIN';

type SessionUser = User & { role?: string; admin?: boolean; id?: string };

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

const applyTokenToSessionUser = (sessionUser: SessionUser, token: JWT): SessionUser => {
  const tokenRole = (token as { role?: string }).role;
  return {
    ...sessionUser,
    role: tokenRole ?? DEFAULT_ROLE,
    admin: (token as { admin?: boolean }).admin ?? isAdminRole(tokenRole),
    id: (token as { id?: string }).id ?? token.sub ?? sessionUser.id,
  };
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
  },
};
