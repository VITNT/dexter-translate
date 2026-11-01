import { redirect } from "next/navigation";
import AccountActions from "../../components/AccountActions";
import BillingButton from "../../components/BillingButton";
import Header from "../../components/Header";
import { getSessionAccount } from "../../lib/auth";
import { effectivePlan, planCatalog } from "../../lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/login?next=/account");
  const plan = effectivePlan(account);
  const planName = planCatalog[plan].name;

  return (
    <>
      <Header activePage="account" />
      <main className="account-shell">
        <section className="account-card">
          <div className="account-avatar" aria-hidden="true">{account.name?.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="auth-kicker">Dexter account</div>
            <h1>{account.name}</h1>
            <p>{account.email}</p>
          </div>
          <div className="account-divider" />
          <div className="account-plan-row">
            <div>
              <span>Current plan</span>
              <strong>{planName}</strong>
              <small>{plan === "business" ? "Up to 50 seats" : plan === "pro" ? "$4.99 per month" : "Core access"}</small>
            </div>
            <span className={`account-plan-badge plan-${plan}`}>{planName}</span>
          </div>
          {account.billing?.stripeCustomerId && (
            <BillingButton signedIn mode="portal" className="account-billing-button">Manage billing</BillingButton>
          )}
          <div className="account-divider" />
          <div className="account-security-copy">
            <strong>Your session is protected</strong>
            <span>Dexter uses an encrypted connection and a secure, browser-inaccessible session cookie.</span>
          </div>
          <div className="account-actions">
            <a className="account-primary" href="/translate">Open translator</a>
            <AccountActions />
          </div>
        </section>
      </main>
    </>
  );
}
