import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';
import { canAccessAdmin } from '@/lib/rbac';
import { isTestMode } from '@/lib/testMode';

export async function middleware(request: NextRequest) {
  if (isTestMode()) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const pathname = request.nextUrl.pathname;

  if (!token) {
    const callbackUrl = `${pathname}${request.nextUrl.search}`;
    const signInUrl = new URL(buildSignInRedirectPath(callbackUrl), request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (!canAccessAdmin(token as { role?: string; admin?: boolean })) {
    const url = request.nextUrl.clone();
    url.pathname = '/403';
    url.search = '';
    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
