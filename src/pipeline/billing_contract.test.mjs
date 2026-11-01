import assert from "node:assert/strict";
import fs from "node:fs";
import { planCatalog } from "../../lib/plans.js";

const root = new URL("../../", import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(new URL("package.json", root), "utf8"));
const checkout = fs.readFileSync(new URL("app/api/billing/checkout/route.js", root), "utf8");
const portal = fs.readFileSync(new URL("app/api/billing/portal/route.js", root), "utf8");
const webhook = fs.readFileSync(new URL("app/api/billing/webhook/route.js", root), "utf8");
const billing = fs.readFileSync(new URL("lib/billing.js", root), "utf8");
const auth = fs.readFileSync(new URL("lib/auth.js", root), "utf8");

assert.ok(packageJson.dependencies.stripe, "Stripe must be a production dependency.");
assert.equal(planCatalog.pro.price, 499);
assert.equal(planCatalog.pro.interval, "month");
assert.equal(planCatalog.business.price, 30000);
assert.equal(planCatalog.business.interval, "year");
assert.equal(planCatalog.business.seats, 50);

assert.match(checkout, /mode:\s*["']subscription["']/);
assert.match(checkout, /subscription_data:\s*\{ metadata \}/);
assert.match(checkout, /\{CHECKOUT_SESSION_ID\}/);
assert.match(portal, /billingPortal\.sessions\.create/);
assert.match(webhook, /constructEvent/);
assert.match(webhook, /await request\.text\(\)/);
assert.match(webhook, /customer\.subscription\.deleted/);
assert.match(billing, /syncSubscription/);
assert.match(auth, /ifMatch:\s*record\.etag/);

console.log("Billing contracts passed: exact prices, subscription Checkout, verified webhooks, portal.");
