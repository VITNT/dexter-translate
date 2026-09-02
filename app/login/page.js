import { redirect } from "next/navigation";
import AuthForm from "../../components/AuthForm";
import Header from "../../components/Header";
import { safeNextPath } from "../../lib/auth-core";
import { getSession } from "../../lib/auth";

export const metadata = { title: "Log in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }) {
  if (await getSession()) redirect("/translate");
  const params = await searchParams;
  const nextPath = safeNextPath(params?.next);

  return (
    <>
      <Header />
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-kicker">Welcome back</div>
          <h1 id="login-title">Log in to Dexter</h1>
          <p>Continue translating and learning sign language.</p>
          <AuthForm mode="login" nextPath={nextPath} />
          <div className="auth-switch">New to Dexter? <a href={`/signup?next=${encodeURIComponent(nextPath)}`}>Create an account</a></div>
        </section>
      </main>
    </>
  );
}
