import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import Stripe from "stripe";

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    const payload = await request.text();
    const sig = request.headers.get("stripe-signature") || "";

    const stripeSecret = process.env["STRIPE_SECRET_KEY"];
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "Missing Stripe secret key" }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" as any });
    let event: Stripe.Event;

    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
      } else {
        if (process.env["NODE_ENV"] === "production") {
          return new Response(JSON.stringify({ error: "Missing Stripe webhook secret in production" }), { status: 400 });
        }
        console.warn("STRIPE_WEBHOOK_SECRET non définie, parsing du payload en direct");
        event = JSON.parse(payload) as Stripe.Event;
      }
    } catch (err: any) {
      console.error(`Error verifying webhook signature: ${err.message}`);
      return new Response(JSON.stringify({ error: err.message }), { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const stripeSessionId = session.id;

      const { error } = await supabaseAdmin
        .from("trip_payments")
        .update({ status: "paid" })
        .eq("stripe_session_id", stripeSessionId);

      if (error) {
        console.error("Failed to update trip payment status in DB:", error);
        return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500 });
      }

      console.log(`Payment successfully updated for session ${stripeSessionId}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
      },
    },
  },
});
