import Translator from "../../components/Translator";
import TranslatorRuntime from "../../components/TranslatorRuntime";

export const metadata = {
  title: "Translate signs",
  description: "Translate ASL and Cambodian Sign Language from your camera.",
  robots: { index: false, follow: false }
};

export default function TranslatePage() {
  return (
    <>
      <Translator />
      <TranslatorRuntime />
    </>
  );
}
