import "server-only";

import Stripe from "stripe";
import { updateAccount } from "./auth";
import { planCatalog, purchasablePlan } from "./plans";

export class BillingConfigurationError extends Error {
  constructor(message = "Billing is not configured yet.") {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

export function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new BillingConfigurationError();
  return new Stripe(secretKey, { appInfo: { name: "Dexter", version: "1.0.0" } });
}

export function checkoutLineItem(planId) {
  const plan = purchasablePlan(planId);
  if (!plan) return null;

  const descriptions = {
    pro: "More usage and text-to-speech today, with priority processing improvements as they ship.",
    business: "Annual institutional access for up to 50 users with centralized billing."
  };

  return {
    price_data: {
      currency: "usd",
      unit_amount: plan.price,
      recurring: { interval: plan.interval },
      product_data: {
        name: plan.name === "Pro" ? "Dexter Pro" : "Dexter B2B Licensing",
        description: descriptions[planId]
      }
    },
    quantity: 1
  };
}

export async function syncSubscription(subscription) {
  const email = subscription?.metadata?.dexterEmail;
  const requestedPlan = subscription?.metadata?.dexterPlan;
  if (!email || !purchasablePlan(requestedPlan)) return null;

  const isPaid = subscription.status === "active" || subscription.status === "trialing";
  const plan = isPaid ? requestedPlan : "free";
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  return updateAccount(email, (account) => {
    account.billing = {
      ...account.billing,
      plan,
      status: subscription.status,
      seats: planCatalog[plan].seats,
      stripeCustomerId: String(subscription.customer || account.billing?.stripeCustomerId || ""),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date().toISOString()
    };
    return account;
  });
}

export async function syncCheckoutSession(checkoutSession) {
  const email = checkoutSession?.metadata?.dexterEmail;
  const planId = checkoutSession?.metadata?.dexterPlan;
  if (!email || !purchasablePlan(planId)) return null;

  const stripe = stripeClient();
  const subscription = typeof checkoutSession.subscription === "string"
    ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
    : checkoutSession.subscription;

  if (subscription) return syncSubscription(subscription);

  return updateAccount(email, (account) => {
    account.billing = {
      ...account.billing,
      plan: "free",
      status: "incomplete",
      seats: 1,
      stripeCustomerId: String(checkoutSession.customer || ""),
      updatedAt: new Date().toISOString()
    };
    return account;
  });
}
