import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/auth/signin' },
  callbacks: {
    authorized: ({ token, req }) => {
      if (!token) return false;
      const pathname = req.nextUrl.pathname;
      const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
      if (isAdminPath) {
        return Boolean((token as any).admin || (token as any).role === 'ADMIN');
      }
      return true;
    },
  },
});

export const config = {
  matcher: ['/((?!api/auth|auth/signin|_next|favicon.ico|public).*)'],
};
