import Learn from "../../components/Learn";
import LearnRuntime from "../../components/LearnRuntime";
import StructuredData from "../../components/StructuredData";
import { siteUrl } from "../../lib/site";

function normalizeLanguage(value) {
  return value === "csl" ? "csl" : "asl";
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const language = normalizeLanguage(params?.lang);
  const languageName = language === "csl" ? "Cambodian Sign Language" : "American Sign Language";
  const languageCode = language.toUpperCase();

  const description = `Explore ${languageName} signs with Dexter's interactive visual dictionary and flashcards.`;

  return {
    title: {
      absolute: `SignDex | ${languageCode}`
    },
    description,
    alternates: {
      canonical: `/learn?lang=${language}`
    },
    openGraph: {
      title: `SignDex | ${languageCode}`,
      description,
      url: `/learn?lang=${language}`
    }
  };
}

export default async function LearnPage({ searchParams }) {
  const params = await searchParams;
  const language = normalizeLanguage(params?.lang);
  const languageName = language === "csl" ? "Cambodian Sign Language" : "American Sign Language";

  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: `SignDex ${language.toUpperCase()} Dictionary`,
          url: new URL(`/learn?lang=${language}`, siteUrl).toString(),
          description: `Interactive ${languageName} visual dictionary and flashcards.`,
          educationalUse: "Practice",
          inLanguage: language === "csl" ? ["km", "en"] : "en"
        }}
      />
      <Learn initialLanguage={language} />
      <LearnRuntime />
    </>
  );
}
