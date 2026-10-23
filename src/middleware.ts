import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  let signedIn = false;
  let mustChange = false;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-not-for-production");
      const { payload } = await jwtVerify(token, secret);
      signedIn = true;
      mustChange = payload.mcp === 1;
    } catch {
      signedIn = false;
    }
  }
  // Static assets (icons, manifest) are public.
  if (/\.(webmanifest|png|svg|ico|jpg|jpeg|webp|txt)$/.test(pathname)) return NextResponse.next();
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  if (!signedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = mustChange ? "/welcome" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // A starting password must be replaced before anything else is used.
  if (signedIn && mustChange && pathname !== "/welcome") {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
