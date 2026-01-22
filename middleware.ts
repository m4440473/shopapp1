import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const pathname = request.nextUrl.pathname;

  if (!token) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  const isAdmin = Boolean((token as { admin?: boolean }).admin) || (token as { role?: string }).role === 'ADMIN';
  if (!isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/403';
    url.search = '';
    const response = NextResponse.rewrite(url);
    response.status = 403;
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
