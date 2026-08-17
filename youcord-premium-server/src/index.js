"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initSchema } = require("./db");
const { registerDiscordOAuthRoutes } = require("./discordOAuth");
const { registerStripeRoutes } = require("./stripe");
const { registerPremiumRoutes } = require("./premium");

const REQUIRED_ENV = [
    "PUBLIC_URL", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET",
    "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET", "DATABASE_URL"
];

for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.warn(`[startup] ATTENTION : variable d'environnement manquante: ${key}`);
    }
}

const app = express();
app.use(cors());

// Le webhook Stripe a besoin du corps brut -> route enregistree avant express.json()
registerStripeRoutes(app);

app.use(express.json());
app.use(express.static("public"));

registerDiscordOAuthRoutes(app);
registerPremiumRoutes(app);

app.get("/", (_req, res) => {
    res.send("YouCord Premium server is running.");
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;

initSchema()
    .then(() => {
        app.listen(port, () => {
            console.log(`YouCord Premium server listening on port ${port}`);
        });
    })
    .catch(err => {
        console.error("Failed to initialize database schema:", err);
        process.exit(1);
    });
