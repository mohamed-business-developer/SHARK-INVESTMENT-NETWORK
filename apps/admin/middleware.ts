import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isPublicAdminPath,
  resolveAdminMiddlewareDecision,
} from '@/lib/auth/origin-and-middleware';
import { getValidatedAdminPublicEnv } from '@/lib/env';

function buildLoginRedirect(request: NextRequest, targetPath: string): NextResponse {
  const url = request.nextUrl.clone();
  const [pathnamePart, queryPart] = targetPath.split('?');
  url.pathname = pathnamePart || '/login';
  url.search = queryPart ? `?${queryPart}` : '';

  const redirectResponse = NextResponse.redirect(url);
  redirectResponse.headers.set(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate, max-age=0',
  );
  return redirectResponse;
}

/**
 * Admin Gate 1 Middleware:
 * Refreshes @supabase/ssr cookies exclusively via server-verified `supabase.auth.getUser()`
 * and blocks unauthenticated traffic from all protected Admin routes fail-closed.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let env: ReturnType<typeof getValidatedAdminPublicEnv>;
  try {
    env = getValidatedAdminPublicEnv();
  } catch {
    if (isPublicAdminPath(pathname)) {
      return NextResponse.next({ request });
    }
    return buildLoginRedirect(request, '/login?error=env');
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [headerName, headerValue] of Object.entries(headers)) {
            response.headers.set(headerName, headerValue);
          }
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const decision = resolveAdminMiddlewareDecision({
    pathname,
    search,
    hasVerifiedUser: !error && Boolean(user),
  });

  if (decision.action === 'redirect_login' && decision.redirectTarget) {
    const redirectResponse = buildLoginRedirect(request, decision.redirectTarget);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
