import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(new URL("package.json", root), "utf8"));
const homePage = fs.readFileSync(new URL("app/page.js", root), "utf8");
const learnPage = fs.readFileSync(new URL("app/learn/page.js", root), "utf8");
const layout = fs.readFileSync(new URL("app/layout.js", root), "utf8");
const robots = fs.readFileSync(new URL("app/robots.js", root), "utf8");
const sitemap = fs.readFileSync(new URL("app/sitemap.js", root), "utf8");
const nextConfig = fs.readFileSync(new URL("next.config.js", root), "utf8");

assert.match(packageJson.scripts.build, /next build/);
assert.ok(packageJson.dependencies.next, "Next.js must be a production dependency.");
assert.match(layout, /metadataBase/);
assert.match(layout, /description:/);
assert.match(homePage, /alternates:[\s\S]*canonical:/);
assert.match(homePage, /WebApplication/);
assert.match(learnPage, /generateMetadata/);
assert.match(learnPage, /LearningResource/);
assert.match(robots, /sitemap/);
assert.match(sitemap, /learn\?lang=asl/);
assert.match(sitemap, /learn\?lang=csl/);
assert.match(sitemap, /pricing/);
assert.match(nextConfig, /source: ["']\/index\.html["']/);
assert.match(nextConfig, /source: ["']\/learn\.html["']/);
assert.equal(fs.existsSync(new URL("index.html", root)), false);
assert.equal(fs.existsSync(new URL("learn.html", root)), false);

console.log("Next.js SEO contracts passed: metadata, canonicals, structured data, robots, and sitemap are present.");
