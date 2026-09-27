import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/courses", "/profile", "/results",
  "/my-courses", "/tracks", "/credentialing"];
const adminRoutes = ["/admin"];
const authRoutes = ["/login", "/register"];

// Paystack IP ranges (whitelist for webhook)
const PAYSTACK_IPS = [
  "52.31.139.75",
  "52.49.173.169",
  "52.214.14.220",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("session")?.value;

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isAdmin = adminRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));
  const isPaystackCallback =
    request.nextUrl.searchParams.get("payment") === "success" ||
    request.nextUrl.searchParams.get("trxref") !== null;

  // Landing page
  if (pathname === "/") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Webhook endpoint — add IP allowlist in production
  if (pathname === "/api/paystack/webhook") {
    return NextResponse.next();
  }

  // Protected routes
  if ((isProtected || isAdmin) && !session && !isPaystackCallback) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth routes — redirect if already logged in
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};