import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { generateRequestId } from "@/lib/request-id";

/**
 * RBAC path rules (default deny):
 *
 * /dashboard          -> viewer+
 * /dashboard/settings -> operator+
 * /register           -> authenticated (any role)
 * /api/contributors   -> operator+ (POST = admin-only for batch recheck)
 * /api/invites        -> admin-only
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isMaintainer = token?.isMaintainer;
    const role = (token?.role as string | undefined) ?? (isMaintainer ? "viewer" : undefined);
    const path = req.nextUrl.pathname;

    // Generate a unique request ID and attach it to forwarded request headers
    // so API route handlers and server components can include it in logs.
    const requestId = generateRequestId();
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-request-id", requestId);

    // /dashboard requires viewer+
    if (path.startsWith("/dashboard")) {
      if (!isMaintainer) {
        const redirectResponse = NextResponse.redirect(
          new URL("/register?error=maintainer", req.url)
        );
        redirectResponse.headers.set("x-request-id", requestId);
        return redirectResponse;
      }

      // /dashboard/settings requires operator+
      if (path.startsWith("/dashboard/settings") && role !== "admin" && role !== "operator") {
        recordAuditLog({
          action: "rbac_middleware_denied",
          metadata: { path, requiredRole: "operator", actualRole: role },
        }).catch(() => {});
        const redirectResponse = NextResponse.redirect(
          new URL("/dashboard?error=insufficient_role", req.url)
        );
        redirectResponse.headers.set("x-request-id", requestId);
        return redirectResponse;
      }
    }

    // /api/invites requires admin
    if (path.startsWith("/api/invites")) {
      if (!isMaintainer || (role !== "admin" && role !== undefined)) {
        // Only admin can access invites
        if (role !== "admin") {
          recordAuditLog({
            action: "rbac_middleware_denied",
            metadata: { path, requiredRole: "admin", actualRole: role },
          }).catch(() => {});
          const forbiddenResponse = NextResponse.json(
            { error: "Forbidden" },
            { status: 403 }
          );
          forbiddenResponse.headers.set("x-request-id", requestId);
          return forbiddenResponse;
        }
      }
    }

    // Pass the request ID forward in both request headers (for server-side
    // handlers to read via headers()) and response headers (for clients to
    // log or display in error UIs).
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        if (path.startsWith("/dashboard")) {
          return !!token;
        }

        if (path.startsWith("/register")) {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/register/:path*", "/api/invites/:path*"],
};