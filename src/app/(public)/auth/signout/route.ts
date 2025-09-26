import { NextResponse } from 'next/server';

function resolveBaseUrl(request: Request) {
  const envBase =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL;
  if (envBase && envBase.length > 0) {
    return envBase;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const baseUrl = resolveBaseUrl(request);
  return NextResponse.redirect(new URL('/api/auth/signout', baseUrl));
}
