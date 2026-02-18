import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/admin", "/dashboard"];

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const session = req.auth;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
