"use strict";

const StripeLib = require("stripe");
const express = require("express");
const { pool } = require("./db");
const { requireAuth } = require("./discordOAuth");

const stripe = StripeLib(process.env.STRIPE_SECRET_KEY);

function registerStripeRoutes(app) {
    // Cree une session Stripe Checkout pour l'utilisateur connecte (identifie via
    // son sessionToken YouCord) et renvoie l'URL a ouvrir dans le navigateur.
    app.post("/api/stripe/create-checkout-session", requireAuth, async (req, res) => {
        try {
            const user = req.user;
            let customerId = user.stripe_customer_id;

            if (!customerId) {
                const customer = await stripe.customers.create({
                    metadata: { discordId: user.discord_id },
                    name: user.discord_username
                });
                customerId = customer.id;
                await pool.query(`UPDATE users SET stripe_customer_id = $1, updated_at = now() WHERE discord_id = $2`, [customerId, user.discord_id]);
            }

            const session = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer: customerId,
                client_reference_id: user.discord_id,
                metadata: { discordId: user.discord_id },
                subscription_data: {
                    metadata: { discordId: user.discord_id }
                },
                line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
                success_url: `${process.env.PUBLIC_URL}/premium-success.html`,
                cancel_url: `${process.env.PUBLIC_URL}/premium-cancel.html`
            });

            res.json({ url: session.url });
        } catch (err) {
            console.error("[stripe/create-checkout-session] error:", err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // Permet a l'utilisateur d'ouvrir le portail Stripe pour gerer/annuler son abonnement.
    app.post("/api/stripe/create-portal-session", requireAuth, async (req, res) => {
        try {
            const user = req.user;
            if (!user.stripe_customer_id) return res.status(400).json({ error: "no_subscription" });

            const portal = await stripe.billingPortal.sessions.create({
                customer: user.stripe_customer_id,
                return_url: `${process.env.PUBLIC_URL}/premium-success.html`
            });

            res.json({ url: portal.url });
        } catch (err) {
            console.error("[stripe/create-portal-session] error:", err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // Webhook Stripe : DOIT recevoir le corps brut (raw), pas du JSON parse -
    // c'est pour ca qu'il utilise son propre express.raw() ici et doit etre
    // monte AVANT tout express.json() global dans index.js.
    app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
        let event;
        try {
            const signature = req.headers["stripe-signature"];
            event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error("[stripe/webhook] signature verification failed:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object;
                    const discordId = session.client_reference_id || session.metadata?.discordId;
                    if (discordId) {
                        await pool.query(
                            `UPDATE users SET premium = true, premium_since = COALESCE(premium_since, now()),
                                stripe_customer_id = $1, stripe_subscription_id = $2, updated_at = now()
                             WHERE discord_id = $3`,
                            [session.customer, session.subscription, discordId]
                        );
                        console.log(`[stripe/webhook] premium unlocked for discordId=${discordId}`);
                    }
                    break;
                }

                case "customer.subscription.updated": {
                    const sub = event.data.object;
                    const isActive = ["active", "trialing"].includes(sub.status);
                    await pool.query(
                        `UPDATE users SET premium = $1, updated_at = now() WHERE stripe_subscription_id = $2`,
                        [isActive, sub.id]
                    );
                    break;
                }

                case "customer.subscription.deleted": {
                    const sub = event.data.object;
                    await pool.query(
                        `UPDATE users SET premium = false, updated_at = now() WHERE stripe_subscription_id = $1`,
                        [sub.id]
                    );
                    break;
                }

                case "invoice.payment_failed": {
                    const invoice = event.data.object;
                    if (invoice.subscription) {
                        await pool.query(
                            `UPDATE users SET premium = false, updated_at = now() WHERE stripe_subscription_id = $1`,
                            [invoice.subscription]
                        );
                    }
                    break;
                }

                default:
                    break;
            }

            res.json({ received: true });
        } catch (err) {
            console.error("[stripe/webhook] handler error:", err);
            res.status(500).json({ error: "internal_error" });
        }
    });
}

module.exports = { registerStripeRoutes };
