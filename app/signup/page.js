import { redirect } from "next/navigation";
import AuthForm from "../../components/AuthForm";
import Header from "../../components/Header";
import { safeNextPath } from "../../lib/auth-core";
import { getSession } from "../../lib/auth";

export const metadata = { title: "Create an account", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }) {
  if (await getSession()) redirect("/translate");
  const params = await searchParams;
  const nextPath = safeNextPath(params?.next);

  return (
    <>
      <Header />
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="signup-title">
          <div className="auth-kicker">Start signing</div>
          <h1 id="signup-title">Create your Dexter account</h1>
          <p>An optional account for a more personal Dexter experience. The translator stays open to everyone.</p>
          <AuthForm mode="signup" nextPath={nextPath} />
          <div className="auth-switch">Already have an account? <a href={`/login?next=${encodeURIComponent(nextPath)}`}>Log in</a></div>
        </section>
      </main>
    </>
  );
}
