import { NextResponse, type NextRequest } from 'next/server';

/**
 * Admin portal middleware shell (Phase 2).
 * Phase 6 (P6-01) wires @supabase/ssr cookie refresh and server-side admin gating.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
