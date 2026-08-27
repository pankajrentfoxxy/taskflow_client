import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/manifest.json', '/icon.svg'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    PUBLIC_PATHS.some((p) => pathname === p)
  ) {
    return NextResponse.next();
  }

  const hasSession =
    !!req.cookies.get('accessToken')?.value || !!req.cookies.get('refreshToken')?.value;

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
