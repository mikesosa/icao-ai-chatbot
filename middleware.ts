import { type NextRequest, NextResponse } from 'next/server';

import { getToken } from 'next-auth/jwt';

import { guestRegex, isDevelopmentEnvironment } from './lib/constants';
import { PARTNER_SLUGS } from './lib/partners/config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathSegments = pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];
  const vanityPartnerSlug = PARTNER_SLUGS.includes(firstSegment)
    ? firstSegment
    : null;
  const isPartnerLanding = pathSegments[0] === 'p' && pathSegments.length === 2;

  if (vanityPartnerSlug && pathSegments.length === 1) {
    return NextResponse.rewrite(
      new URL(`/p/${vanityPartnerSlug}`, request.url),
    );
  }

  let vanityRewriteUrl: URL | null = null;
  if (vanityPartnerSlug && pathSegments.length > 1) {
    const restPath = pathname.slice(vanityPartnerSlug.length + 1);
    vanityRewriteUrl = new URL(
      `/p/${vanityPartnerSlug}${restPath}`,
      request.url,
    );
  }

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Allow access to auth routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Allow access to Rebill webhooks
  if (pathname.startsWith('/api/rebill/webhook')) {
    return NextResponse.next();
  }

  // Allow access to audio files for exam functionality
  if (pathname.startsWith('/api/audio')) {
    return NextResponse.next();
  }

  // Allow public access to partner landing pages
  if (isPartnerLanding) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // Allow access to auth pages for unauthenticated users
  if (['/login', '/register'].includes(pathname)) {
    // If user is already authenticated (and not a guest), redirect to home
    if (token && !guestRegex.test(token?.email ?? '')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // For all other routes, require authentication
  if (!token) {
    // Store the attempted URL to redirect back after login
    const redirectUrl = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${redirectUrl}`, request.url),
    );
  }

  // If user is a guest, redirect to login (guests are no longer allowed to access the app)
  const isGuest = guestRegex.test(token?.email ?? '');
  if (isGuest) {
    const redirectUrl = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${redirectUrl}`, request.url),
    );
  }

  if (vanityRewriteUrl) {
    return NextResponse.rewrite(vanityRewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
