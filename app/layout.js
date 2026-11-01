import "./globals.css";
import { siteDescription, siteName, siteUrl } from "../lib/site";

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
      <body>{children}</body>
    </html>
  );
}
