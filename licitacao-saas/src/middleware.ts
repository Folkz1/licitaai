import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for session token cookie (NextAuth sets this)
  const token =
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token");

  // Logged-in user on "/" → redirect to dashboard
  if (pathname === "/" && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Public routes - skip auth check
  if (
    pathname === "/" ||
    pathname.startsWith("/editais") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/fornecedores") ||
    pathname.startsWith("/precos") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/acesso") ||
    pathname.startsWith("/orquestra") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/blog") ||
    pathname.startsWith("/api/track") ||
    pathname.startsWith("/api/jobs/scrape-pncp") ||
    pathname.startsWith("/api/n8n/callback") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/service") ||
    pathname.startsWith("/api/webhook/") ||
    pathname.startsWith("/api/leads/enrich") ||
    pathname.startsWith("/api/onboarding/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemap") ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/guia") ||
    pathname.endsWith(".html")
  ) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Cookie exists - let the page/API route do the full auth check
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
