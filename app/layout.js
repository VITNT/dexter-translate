import "./globals.css";
import { Battambang, Manrope } from "next/font/google";
import { siteDescription, siteName, siteUrl } from "../lib/site";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope"
});

const battambang = Battambang({
  weight: ["400", "700"],
  subsets: ["khmer"],
  display: "swap",
  variable: "--font-battambang"
});

export const metadata = {
  metadataBase: siteUrl,
  title: {
    default: `${siteName} | Sign Language Translation`,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "sign language translator",
    "ASL translator",
    "Cambodian Sign Language",
    "Khmer Sign Language",
    "sign language dictionary"
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  },
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName} | Sign Language Translation`,
    description: siteDescription,
    url: "/"
  },
  twitter: {
    card: "summary",
    title: `${siteName} | Sign Language Translation`,
    description: siteDescription
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${battambang.variable}`}>{children}</body>
    </html>
  );
}
