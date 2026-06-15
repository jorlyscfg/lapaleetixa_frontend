import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  // 1. If it's a customer-facing public page request: /c/[tenant]
  const pathParts = url.pathname.split("/");
  if (pathParts[1] === "c" && pathParts[2]) {
    const tenant = pathParts[2].toLowerCase().trim();
    const response = NextResponse.next();

    // Set cookie to keep tenant context on client-side requests
    response.cookies.set("tenant_name", tenant, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  }

  // 2. Proxy requests starting with /api/ or /files/
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/files/")) {
    const incomingHost = request.headers.get("host") || "";
    const hostname = incomingHost.split(":")[0];

    const referer = request.headers.get("referer") || "";
    let tenantSubdomain = request.cookies.get("tenant_name")?.value || "";

    // Fallback to referer if cookie not present yet
    if (!tenantSubdomain && referer) {
      const match = referer.match(/\/c\/([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        tenantSubdomain = match[1];
      }
    }

    // Resolve base domain dynamically
    let baseDomain = "localhost";
    const isIP = /^[0-9.]+$/.test(hostname);
    if (isIP) {
      baseDomain = hostname;
    } else if (hostname.includes("localhost")) {
      baseDomain = "localhost";
    } else if (hostname.endsWith(".local") || hostname.includes(".local:")) {
      baseDomain = "local";
    } else {
      const parts = hostname.split(".");
      if (parts.length > 2) {
        baseDomain = parts.slice(1).join(".");
      } else {
        baseDomain = hostname;
      }
    }

    // Determine the virtual base domain for Gunicorn site directory resolution
    const virtualBaseDomain = isIP ? "localhost" : baseDomain;

    let backendHost = "";
    let siteName = "";
    if (tenantSubdomain && tenantSubdomain !== "master" && tenantSubdomain !== "admin" && tenantSubdomain !== "frontend") {
      backendHost = `${tenantSubdomain}.${virtualBaseDomain}:8080`;
      siteName = `${tenantSubdomain}.${virtualBaseDomain}`;
    } else {
      // Default to master site backend
      siteName = `frontend.${virtualBaseDomain}`;
      if (virtualBaseDomain === "localhost") {
        backendHost = "frontend.localhost:8080";
      } else if (virtualBaseDomain === "local") {
        backendHost = "frontend.local:8080";
      } else {
        backendHost = `frontend.${virtualBaseDomain}:8080`;
      }
    }

    // Rewrite the destination using backendHost to ensure Next.js sends the correct Host header
    const destination = `http://${backendHost}${url.pathname}${url.search}`;

    // Clone headers and inject Host and site name headers for Frappe's multi-tenant resolution
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Host", backendHost);
    requestHeaders.set("X-Frappe-Site-Name", siteName);

    return NextResponse.rewrite(new URL(destination), {
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/files/:path*", "/c/:path*"],
};
