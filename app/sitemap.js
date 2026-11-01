import { siteUrl } from "../lib/site";

export default function sitemap() {
  return [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: new URL("/learn?lang=asl", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: new URL("/learn?lang=csl", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.8
    }
  ];
}
