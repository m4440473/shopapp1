import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { compare } from 'bcryptjs';

export const authOptions: NextAuthOptions = {
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
          console.log('Missing credentials');
          return null;
        }
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) {
          console.log('User not found:', credentials.email);
          return null;
        }
        if (!user.active) {
          console.log('User not active:', credentials.email);
          return null;
        }
        if (!user.passwordHash) {
          console.log('No passwordHash for user:', credentials.email);
          return null;
        }
        const ok = await compare(credentials.password, user.passwordHash);
        console.log('Password compare:', credentials.password, user.passwordHash, ok);
        if (!ok) {
          console.log('Password incorrect for user:', credentials.email);
          return null;
        }
        console.log('Sign-in success for user:', credentials.email);
        return { id: user.id, email: user.email, name: user.name ?? '', role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // user.role comes from the Prisma DB as a string; default to 'MACHINIST' for legacy/seeding cases
        (token as any).role = (user as any).role ?? 'MACHINIST';
        (token as any).id = (user as any).id ?? token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role;
        (session.user as any).id = (token as any).id ?? token.sub ?? (session.user as any).id;
      }
      return session;
    },
  },
};
