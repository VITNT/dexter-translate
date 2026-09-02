import { NextResponse } from "next/server";
import { getSessionAccount, sameOriginRequest } from "../../../../lib/auth";
import {
  BillingConfigurationError,
  checkoutLineItem,
  stripeClient
} from "../../../../lib/billing";
import { effectivePlan, purchasablePlan } from "../../../../lib/plans";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const account = await getSessionAccount();
  if (!account) {
    return NextResponse.json({ error: "Create an account or log in before subscribing." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const plan = purchasablePlan(body.plan);
    if (!plan) return NextResponse.json({ error: "Choose a valid paid plan." }, { status: 400 });
    if (effectivePlan(account) !== "free") {
      return NextResponse.json({ error: "Manage your existing subscription from your account." }, { status: 409 });
    }

    const stripe = stripeClient();
    const origin = new URL(request.url).origin;
    const customer = account.billing?.stripeCustomerId;
    const metadata = {
      dexterUserId: account.id,
      dexterEmail: account.email,
      dexterPlan: plan.id
    };
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: account.id,
      ...(customer ? { customer } : { customer_email: account.email }),
      line_items: [checkoutLineItem(plan.id)],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Stripe Checkout creation failed.", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 502 });
  }
}
