import { NextResponse } from 'next/server';

import { resolveBaseUrl } from '@/lib/base-url';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fallbackBaseUrl = `${url.protocol}//${url.host}`;
  const baseUrl =
    resolveBaseUrl({
      envBaseUrl:
        process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL,
      fallbackBaseUrl,
    }) || fallbackBaseUrl;

  return NextResponse.redirect(new URL('/api/auth/signout', baseUrl));
}
