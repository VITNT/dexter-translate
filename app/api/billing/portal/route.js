import { NextResponse } from "next/server";
import { getSessionAccount, sameOriginRequest } from "../../../../lib/auth";
import { BillingConfigurationError, stripeClient } from "../../../../lib/billing";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const account = await getSessionAccount();
  if (!account) return NextResponse.json({ error: "Log in to manage billing." }, { status: 401 });
  if (!account.billing?.stripeCustomerId) {
    return NextResponse.json({ error: "No paid subscription is connected to this account." }, { status: 404 });
  }

  try {
    const stripe = stripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: account.billing.stripeCustomerId,
      return_url: `${new URL(request.url).origin}/account`
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Stripe portal creation failed.", error);
    return NextResponse.json({ error: "Billing management is temporarily unavailable." }, { status: 502 });
  }
}
