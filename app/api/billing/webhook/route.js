import { stripeClient, syncCheckoutSession, syncSubscription } from "../../../../lib/billing";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response("Webhook is not configured.", { status: 503 });
  }

  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch (error) {
    console.warn("Stripe webhook signature rejected.", error.message);
    return new Response("Invalid signature.", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await syncCheckoutSession(event.data.object);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook processing failed for ${event.id}.`, error);
    return new Response("Webhook processing failed.", { status: 500 });
  }
}
