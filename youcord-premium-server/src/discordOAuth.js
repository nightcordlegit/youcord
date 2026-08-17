"use strict";

const crypto = require("crypto");
const { pool, cleanupOldSessions } = require("./db");

const DISCORD_API = "https://discord.com/api/v10";

function redirectUri() {
    return `${process.env.PUBLIC_URL}/api/oauth2/callback`;
}

function registerDiscordOAuthRoutes(app) {
    // Appele par le client YouCord (beginDiscordOAuth) pour demarrer une connexion.
    // Le client fournit un "state" aleatoire qu'il garde en memoire pour ensuite
    // pouvoir "poll" /api/oauth2/check avec ce meme state.
    app.get("/api/oauth2/signing", async (req, res) => {
        try {
            await cleanupOldSessions();

            const state = typeof req.query.state === "string" && req.query.state.length > 0
                ? req.query.state
                : crypto.randomBytes(16).toString("hex");

            await pool.query(
                `INSERT INTO oauth_sessions (state, status) VALUES ($1, 'pending')
                 ON CONFLICT (state) DO UPDATE SET status = 'pending', created_at = now()`,
                [state]
            );

            const scopes = ["identify"];
            const url = new URL("https://discord.com/oauth2/authorize");
            url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
            url.searchParams.set("redirect_uri", redirectUri());
            url.searchParams.set("response_type", "code");
            url.searchParams.set("scope", scopes.join(" "));
            url.searchParams.set("state", state);
            url.searchParams.set("prompt", "consent");

            res.json({
                url: url.toString(),
                redirectUri: redirectUri(),
                scopes,
                state
            });
        } catch (err) {
            console.error("[oauth2/signing] error:", err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // C'est le redirect_uri configure sur l'application Discord.
    // Discord redirige l'utilisateur ici apres qu'il ait autorise l'appli.
    app.get("/api/oauth2/callback", async (req, res) => {
        const { code, state, error } = req.query;

        if (error) {
            return res.status(400).send(renderPage("Connexion annulée", "Tu as annulé la connexion Discord. Tu peux fermer cette fenêtre."));
        }

        if (!code || !state) {
            return res.status(400).send(renderPage("Erreur", "Lien invalide. Retourne sur Discord et réessaie."));
        }

        try {
            const sessionRow = await pool.query(`SELECT * FROM oauth_sessions WHERE state = $1`, [state]);
            if (sessionRow.rowCount === 0) {
                return res.status(400).send(renderPage("Lien expiré", "Cette tentative de connexion a expiré. Retourne sur Discord et relance la connexion."));
            }

            // Echange le code contre un access token Discord
            const tokenResp = await fetch(`${DISCORD_API}/oauth2/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.DISCORD_CLIENT_ID,
                    client_secret: process.env.DISCORD_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: String(code),
                    redirect_uri: redirectUri()
                })
            });

            if (!tokenResp.ok) {
                console.error("[oauth2/callback] token exchange failed:", await tokenResp.text());
                return res.status(400).send(renderPage("Erreur", "Impossible de vérifier ta connexion Discord. Réessaie depuis Discord."));
            }

            const tokenData = await tokenResp.json();

            const meResp = await fetch(`${DISCORD_API}/users/@me`, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            if (!meResp.ok) {
                return res.status(400).send(renderPage("Erreur", "Impossible de récupérer ton profil Discord."));
            }
            const me = await meResp.json();

            const sessionToken = crypto.randomBytes(32).toString("hex");

            await pool.query(
                `INSERT INTO users (discord_id, discord_username, session_token, updated_at)
                 VALUES ($1, $2, $3, now())
                 ON CONFLICT (discord_id) DO UPDATE SET
                     discord_username = EXCLUDED.discord_username,
                     session_token = EXCLUDED.session_token,
                     updated_at = now()`,
                [me.id, me.username, sessionToken]
            );

            await pool.query(
                `UPDATE oauth_sessions SET status = 'complete', discord_id = $1, discord_username = $2, session_token = $3 WHERE state = $4`,
                [me.id, me.username, sessionToken, state]
            );

            res.send(renderPage(
                "Connecté !",
                `Connecté en tant que <b>${escapeHtml(me.username)}</b>. Tu peux fermer cette fenêtre et retourner sur Discord.`
            ));
        } catch (err) {
            console.error("[oauth2/callback] error:", err);
            res.status(500).send(renderPage("Erreur", "Une erreur est survenue. Réessaie depuis Discord."));
        }
    });

    // Le client "poll" cette route avec le state renvoyé par /signing jusqu'à
    // obtenir status: "complete".
    app.get("/api/oauth2/check", async (req, res) => {
        const token = req.query.token;
        if (!token || typeof token !== "string") {
            return res.status(400).json({ status: "error", error: "missing_token" });
        }

        try {
            const result = await pool.query(`SELECT * FROM oauth_sessions WHERE state = $1`, [token]);
            if (result.rowCount === 0) {
                return res.status(404).json({ status: "not_found" });
            }

            const row = result.rows[0];
            if (row.status !== "complete") {
                return res.json({ status: "pending" });
            }

            res.json({
                status: "complete",
                sessionToken: row.session_token,
                discordId: row.discord_id,
                username: row.discord_username
            });
        } catch (err) {
            console.error("[oauth2/check] error:", err);
            res.status(500).json({ status: "error" });
        }
    });
}

// Middleware : verifie l'en-tete "Authorization: Bearer <sessionToken>"
// et attache req.user si valide.
async function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "unauthorized" });

    try {
        const result = await pool.query(`SELECT * FROM users WHERE session_token = $1`, [token]);
        if (result.rowCount === 0) return res.status(401).json({ error: "unauthorized" });
        req.user = result.rows[0];
        next();
    } catch (err) {
        console.error("[requireAuth] error:", err);
        res.status(500).json({ error: "internal_error" });
    }
}

function renderPage(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)} · YouCord</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{background:#1e1f22;color:#f2f3f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px;box-sizing:border-box}
  .card{background:#2b2d31;padding:32px 40px;border-radius:12px;max-width:420px}
  h1{font-size:20px;margin:0 0 12px}
  p{color:#b5bac1;line-height:1.5}
  b{color:#f2f3f5}
</style></head>
<body><div class="card"><h1>${escapeHtml(title)}</h1><p>${bodyHtml}</p></div></body></html>`;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[c]));
}

module.exports = { registerDiscordOAuthRoutes, requireAuth, renderPage, escapeHtml };
