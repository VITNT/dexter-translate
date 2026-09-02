export const planCatalog = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: null,
    seats: 1
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 499,
    interval: "month",
    seats: 1
  },
  business: {
    id: "business",
    name: "B2B Licensing",
    price: 30000,
    interval: "year",
    seats: 50
  }
};

const PAID_STATUSES = new Set(["active", "trialing"]);

export function effectivePlan(account) {
  const billing = account?.billing;
  if (!billing || billing.plan === "free") return "free";
  return PAID_STATUSES.has(billing.status) ? billing.plan : "free";
}

export function hasProAccess(account) {
  return effectivePlan(account) === "pro" || effectivePlan(account) === "business";
}

export function purchasablePlan(planId) {
  return planId === "pro" || planId === "business" ? planCatalog[planId] : null;
}
