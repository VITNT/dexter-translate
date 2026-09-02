import BillingButton from "../../components/BillingButton";
import Header from "../../components/Header";
import StructuredData from "../../components/StructuredData";
import { getSessionAccount } from "../../lib/auth";
import { effectivePlan } from "../../lib/plans";
import { siteUrl } from "../../lib/site";

export const metadata = {
  title: "Pricing",
  description: "Choose Dexter Free, Pro, or institutional licensing.",
  alternates: { canonical: "/pricing" }
};

const check = <span className="pricing-check" aria-hidden="true">✓</span>;

export default async function PricingPage({ searchParams }) {
  const account = await getSessionAccount();
  const plan = effectivePlan(account);
  const params = await searchParams;

  return (
    <>
      <StructuredData data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Dexter sign language translation",
        url: new URL("/pricing", siteUrl).toString(),
        offers: [
          { "@type": "Offer", name: "Dexter Free", price: "0", priceCurrency: "USD" },
          { "@type": "Offer", name: "Dexter Pro", price: "4.99", priceCurrency: "USD" },
          { "@type": "Offer", name: "Dexter B2B", price: "300", priceCurrency: "USD" }
        ]
      }} />
      <Header activePage="pricing" />
      <main className="pricing-main">
        <section className="pricing-intro">
          <div className="landing-eyebrow"><span /> Simple, transparent pricing</div>
          <h1>Start free. Upgrade when Dexter becomes essential.</h1>
          <p>The translator and dictionary remain open to everyone. Paid plans add capacity and premium workflow tools.</p>
          {params?.checkout === "cancelled" && (
            <div className="pricing-notice" role="status">Checkout was cancelled. Nothing was charged.</div>
          )}
        </section>

        <section className="pricing-grid" aria-label="Dexter plans">
          <article className={`pricing-card${plan === "free" ? " current" : ""}`}>
            <div className="pricing-plan-label">Free</div>
            <div className="pricing-price"><strong>$0</strong><span>forever</span></div>
            <p>Everything needed to try the MVP and keep communicating.</p>
            <ul>
              <li>{check} Sign-to-text translation</li>
              <li>{check} Multiple sign languages</li>
              <li>{check} ASL and CSL dictionaries</li>
              <li>{check} Fair-use daily capacity</li>
            </ul>
            <a className="pricing-button pricing-button-secondary" href="/translate">
              {plan === "free" ? "Use Dexter free" : "Open translator"}
            </a>
          </article>

          <article className={`pricing-card pricing-card-featured${plan === "pro" ? " current" : ""}`}>
            <div className="pricing-popular">Most popular</div>
            <div className="pricing-plan-label">Pro</div>
            <div className="pricing-price"><strong>$4.99</strong><span>per month</span></div>
            <p>For people who use Dexter regularly and want the premium workflow.</p>
            <ul>
              <li>{check} Everything in Free</li>
              <li>{check} Text-to-speech access</li>
              <li>{check} Higher usage allowance</li>
              <li>{check} Advertisement-free experience</li>
              <li className="pricing-coming">↗ Text-to-sign, faster processing, and accuracy priority as they launch</li>
            </ul>
            {plan === "pro" || plan === "business" ? (
              <BillingButton signedIn mode="portal" className="pricing-button">Manage subscription</BillingButton>
            ) : (
              <BillingButton plan="pro" signedIn={Boolean(account)} className="pricing-button">Upgrade to Pro</BillingButton>
            )}
          </article>

          <article className={`pricing-card${plan === "business" ? " current" : ""}`}>
            <div className="pricing-plan-label">B2B Licensing</div>
            <div className="pricing-price"><strong>$300</strong><span>per institution / year</span></div>
            <p>For schools and organizations bringing Dexter into classrooms and workplaces.</p>
            <ul>
              <li>{check} Up to 50 user accounts</li>
              <li>{check} Shared pool of translation minutes</li>
              <li>{check} Centralized account and usage management</li>
              <li>{check} Priority processing and support</li>
              <li>{check} Advertisement-free experience</li>
            </ul>
            {plan === "business" ? (
              <BillingButton signedIn mode="portal" className="pricing-button pricing-button-dark">Manage license</BillingButton>
            ) : plan === "pro" ? (
              <BillingButton signedIn mode="portal" className="pricing-button pricing-button-dark">Change plan in billing</BillingButton>
            ) : (
              <BillingButton plan="business" signedIn={Boolean(account)} className="pricing-button pricing-button-dark">Buy institutional license</BillingButton>
            )}
          </article>
        </section>

        <section className="pricing-honesty">
          <strong>Built honestly, shipped in stages.</strong>
          <p>Payments, plan status, text-to-speech entitlement, and billing management are part of this release. Text-to-sign and upgraded accuracy/priority models are listed as roadmap benefits and will activate when those systems ship.</p>
        </section>
      </main>
    </>
  );
}
