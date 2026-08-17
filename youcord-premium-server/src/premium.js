"use strict";

const { requireAuth } = require("./discordOAuth");

function registerPremiumRoutes(app) {
    // Le plugin YouCord Premium "poll" cette route regulierement pour savoir
    // si l'utilisateur doit voir le badge / les cosmetiques premium debloques.
    app.get("/api/premium/status", requireAuth, async (req, res) => {
        const user = req.user;
        res.json({
            discordId: user.discord_id,
            username: user.discord_username,
            premium: user.premium,
            premiumSince: user.premium_since
        });
    });
}

module.exports = { registerPremiumRoutes };
