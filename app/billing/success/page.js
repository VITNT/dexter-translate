import { redirect } from "next/navigation";
import Header from "../../../components/Header";
import { getSessionAccount } from "../../../lib/auth";
import {
  BillingConfigurationError,
  stripeClient,
  syncCheckoutSession
} from "../../../lib/billing";
import { effectivePlan, planCatalog } from "../../../lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment complete", robots: { index: false, follow: false } };

export default async function BillingSuccessPage({ searchParams }) {
  const account = await getSessionAccount();
  const params = await searchParams;
  const sessionId = params?.session_id;
  if (!account) redirect(`/login?next=${encodeURIComponent(`/billing/success?session_id=${sessionId || ""}`)}`);

  let message = "We are confirming your subscription.";
  let paidPlan = effectivePlan(account);
  let checkout = null;
  try {
    if (sessionId) {
      checkout = await stripeClient().checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"]
      });
    }
  } catch (error) {
    if (!(error instanceof BillingConfigurationError)) {
      console.error("Checkout confirmation failed.", error);
    }
  }

  if (checkout?.client_reference_id && checkout.client_reference_id !== account.id) {
    redirect("/pricing");
  }
  if (checkout) {
    try {
      const updated = await syncCheckoutSession(checkout);
      paidPlan = effectivePlan(updated || account);
      message = paidPlan === "free"
        ? "Payment is still processing. Your plan will update automatically."
        : `${planCatalog[paidPlan].name} is now active on your account.`;
    } catch (error) {
      console.error("Checkout account sync failed.", error);
      message = "Payment was received. Your plan will update automatically as soon as Stripe confirms it.";
    }
  }

  return (
    <>
      <Header />
      <main className="billing-result-shell">
        <section className="billing-result-card">
          <div className="billing-result-icon" aria-hidden="true">✓</div>
          <div className="auth-kicker">Payment complete</div>
          <h1>Thank you for supporting Dexter.</h1>
          <p>{message}</p>
          <div className="billing-result-actions">
            <a className="account-primary" href="/translate">Open translator</a>
            <a className="pricing-button pricing-button-secondary" href="/account">View account</a>
          </div>
        </section>
      </main>
    </>
  );
}
