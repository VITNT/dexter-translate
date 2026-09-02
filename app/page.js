import Header from "../components/Header";
import StructuredData from "../components/StructuredData";
import { getSession } from "../lib/auth";
import { siteDescription, siteName, siteUrl } from "../lib/site";

export const metadata = {
  title: {
    absolute: `${siteName}`
  },
  description: siteDescription,
  alternates: {
    canonical: "/"
  }
};

export default async function HomePage() {
  const session = await getSession();
  const primaryHref = "/translate";
  const primaryLabel = session ? "Open translator" : "Try the translator";

  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: siteName,
          url: siteUrl.toString(),
          description: siteDescription,
          applicationCategory: "EducationalApplication",
          operatingSystem: "Any modern web browser",
          inLanguage: ["en", "km"]
        }}
      />
      <Header activePage="home" />
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> Communication without barriers</div>
            <h1>Turn signs into words, <em>in real time.</em></h1>
            <p className="landing-lede">
              Dexter recognizes American and Cambodian Sign Language through your camera,
              then helps you understand, speak, and learn the result.
            </p>
            <div className="landing-actions">
              <a className="landing-primary" href={primaryHref}>{primaryLabel}</a>
              <a className="landing-secondary" href="/pricing">View pricing</a>
            </div>
            <div className="landing-trust">
              <span><b>Browser-first</b> recognition</span>
              <span><b>ASL + CSL</b> support</span>
              <span><b>No account</b> required</span>
            </div>
          </div>

          <div className="landing-demo" aria-label="Preview of Dexter sign translation">
            <div className="landing-demo-top">
              <span className="landing-live-dot" /> Live translation
              <span className="landing-demo-language">ASL spelling</span>
            </div>
            <div className="landing-camera">
              <div className="landing-hand" aria-hidden="true">
                <span className="hand-palm" />
                <span className="hand-finger finger-one" />
                <span className="hand-finger finger-two" />
                <span className="hand-finger finger-three" />
                <span className="hand-finger finger-four" />
                <span className="hand-thumb" />
                <i className="hand-point point-a" /><i className="hand-point point-b" />
                <i className="hand-point point-c" /><i className="hand-point point-d" />
              </div>
              <div className="landing-focus-corner corner-one" />
              <div className="landing-focus-corner corner-two" />
              <span className="landing-confidence">98% confidence</span>
            </div>
            <div className="landing-demo-result">
              <div><span>Detected sign</span><strong>Hello</strong></div>
              <div lang="km"><span>Khmer</span><strong>សួស្តី</strong></div>
              <button type="button" tabIndex="-1" aria-hidden="true">▶</button>
            </div>
          </div>
        </section>

        <section className="landing-feature-strip" aria-labelledby="how-title">
          <div className="landing-section-heading">
            <span>Simple by design</span>
            <h2 id="how-title">A clearer way to connect</h2>
          </div>
          <div className="landing-feature-grid">
            <article>
              <div className="feature-number">01</div>
              <h3>Sign naturally</h3>
              <p>Use the camera already on your phone or computer. Dexter guides your timing as you sign.</p>
            </article>
            <article>
              <div className="feature-number">02</div>
              <h3>Understand instantly</h3>
              <p>See recognized signs become clear English and Khmer, with context-aware interpretation.</p>
            </article>
            <article>
              <div className="feature-number">03</div>
              <h3>Build confidence</h3>
              <p>Practice with visual dictionaries and flashcards for both ASL and Cambodian Sign Language.</p>
            </article>
          </div>
        </section>

        <section className="landing-cta-band">
          <div>
            <span>Ready when you are</span>
            <h2>Make every conversation count.</h2>
          </div>
          <a href={primaryHref}>{primaryLabel} <span aria-hidden="true">→</span></a>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="dex-logo dex-logo-link" href="/"><img src="/logo.png" alt="" width="36" height="36" /><span className="dex-blue">Dexter</span></a>
        <p>Sign language translation and learning for more inclusive conversations.</p>
        <nav aria-label="Footer navigation"><a href="/translate">Translate</a><a href="/pricing">Pricing</a><a href="/learn?lang=asl">Learn ASL</a><a href="/learn?lang=csl">Learn CSL</a></nav>
      </footer>
    </>
  );
}
