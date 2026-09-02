import { NextResponse } from "next/server";
import { safeNextPath } from "../../../../lib/auth-core";
import {
  authenticateAccount,
  issueSession,
  sameOriginRequest,
  sessionCookieName,
  sessionCookieOptions
} from "../../../../lib/auth";
import { authRateLimit } from "../../../../lib/auth-rate-limit";

export const runtime = "nodejs";

export async function POST(request) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const rateLimit = authRateLimit(request, "login");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const account = await authenticateAccount(body.email, body.password);
    if (!account) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const response = NextResponse.json({
      user: account,
      redirectTo: safeNextPath(body.next)
    });
    response.cookies.set(sessionCookieName, issueSession(account), sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Dexter login failed.", error);
    return NextResponse.json({ error: "Login is temporarily unavailable." }, { status: 503 });
  }
}
