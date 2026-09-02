import { NextResponse } from "next/server";
import { AuthValidationError, safeNextPath } from "../../../../lib/auth-core";
import {
  AccountExistsError,
  createAccount,
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

  const rateLimit = authRateLimit(request, "signup");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const account = await createAccount(body);
    const response = NextResponse.json(
      { user: account, redirectTo: safeNextPath(body.next) },
      { status: 201 }
    );
    response.cookies.set(sessionCookieName, issueSession(account), sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: 400 });
    }
    if (error instanceof AccountExistsError) {
      return NextResponse.json({ error: error.message, field: "email" }, { status: 409 });
    }
    console.error("Dexter account creation failed.", error);
    return NextResponse.json({ error: "Account creation is temporarily unavailable." }, { status: 503 });
  }
}
