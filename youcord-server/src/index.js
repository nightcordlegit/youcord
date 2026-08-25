import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    SERVER_URL,
    PORT = "3674",
    CORS_ORIGINS = "https://discord.com,https://ptb.discord.com,https://canary.discord.com",
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SERVER_URL) {
    console.error("Missing required env vars: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SERVER_URL");
    process.exit(1);
}

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error("Missing required env vars: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME");
    process.exit(1);
}

const REDIRECT_URI = `${SERVER_URL}/api/oauth2/callback`;
const SCOPES = ["identify", "guilds.join"];

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const db = await mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
});

// Create tables
await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
        discord_id   VARCHAR(64) PRIMARY KEY,
        token        VARCHAR(128) NOT NULL UNIQUE,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await db.execute(`
    CREATE TABLE IF NOT EXISTS plugin_configs (
        discord_id   VARCHAR(64) NOT NULL,
        plugin_name  VARCHAR(128) NOT NULL,
        settings     JSON NOT NULL,
        is_private   TINYINT(1) NOT NULL DEFAULT 0,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (discord_id, plugin_name),
        FOREIGN KEY (discord_id) REFERENCES users(discord_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

console.log("[YouCord Server] Database connected & tables ready");

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(cors({
    origin: CORS_ORIGINS.split(",").map(s => s.trim()),
    methods: ["GET", "PUT", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
}));

// Root — simple health status
app.get("/", (_req, res) => {
    res.type("text/plain").send("YouCord API is operational.");
});

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
});

// ---------------------------------------------------------------------------
// OAuth2 endpoints
// ---------------------------------------------------------------------------

// GET /api/oauth2/signing — returns the Discord authorization URL
app.get("/api/oauth2/signing", (req, res) => {
    const state = req.query.state || crypto.randomUUID();

    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", DISCORD_CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("state", state);

    res.json({
        url: url.toString(),
        redirectUri: REDIRECT_URI,
        scopes: SCOPES,
    });
});

// GET /api/oauth2/callback — Discord redirects here after auth
app.get("/api/oauth2/callback", async (req, res) => {
    const { code, error } = req.query;
    const wantsJson = (req.headers.accept || "").includes("application/json");

    const respond = (data, status = 200) => {
        if (wantsJson) {
            return res.status(status).json(data);
        }
        const payload = JSON.stringify(data);
        return res.status(status).send(`
            <html><body><script>
                window.opener?.postMessage(${payload}, "*");
                window.close();
            </script></body></html>
        `);
    };

    if (error || !code) {
        return respond({ error: error || "No code provided" }, 400);
    }

    try {
        // Exchange code for Discord access token
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
            }),
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            return respond({ error: tokenData.error_description || tokenData.error }, 400);
        }

        // Get user info from Discord
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json();

        if (!userData.id) {
            return respond({ error: "Failed to get user info from Discord" }, 502);
        }

        // Generate our own opaque token
        const ourToken = crypto.randomUUID();

        // Store or update user
        await db.execute(
            "INSERT INTO users (discord_id, token) VALUES (?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), updated_at = NOW()",
            [userData.id, ourToken]
        );

        respond({ token: ourToken, discord_id: userData.id });
    } catch (err) {
        console.error("[OAuth2 Callback]", err);
        respond({ error: "Internal server error" }, 500);
    }
});

// GET /api/oauth2/check?token=... — validate a token
app.get("/api/oauth2/check", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const [rows] = await db.execute("SELECT discord_id FROM users WHERE token = ?", [token]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid token" });

    res.json({ discord_id: rows[0].discord_id, valid: true });
});

// ---------------------------------------------------------------------------
// Plugin sync endpoints
// ---------------------------------------------------------------------------

// GET /api/sync/:pluginName?token=... — get own config
app.get("/api/sync/:pluginName", async (req, res) => {
    const { token } = req.query;
    const { pluginName } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });

    const [users] = await db.execute("SELECT discord_id FROM users WHERE token = ?", [token]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid token" });

    const [configs] = await db.execute(
        "SELECT settings FROM plugin_configs WHERE discord_id = ? AND plugin_name = ?",
        [users[0].discord_id, pluginName]
    );

    if (configs.length === 0) return res.json({ settings: {} });
    res.json({ settings: typeof configs[0].settings === "string" ? JSON.parse(configs[0].settings) : configs[0].settings });
});

// PUT /api/sync/:pluginName — save own config
app.put("/api/sync/:pluginName", async (req, res) => {
    const { token, settings, private: isPrivate } = req.body;
    const { pluginName } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });

    const [users] = await db.execute("SELECT discord_id FROM users WHERE token = ?", [token]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid token" });

    const settingsJson = JSON.stringify(settings || {});
    const privateFlag = isPrivate ? 1 : 0;

    await db.execute(
        `INSERT INTO plugin_configs (discord_id, plugin_name, settings, is_private)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE settings = VALUES(settings), is_private = VALUES(is_private), updated_at = NOW()`,
        [users[0].discord_id, pluginName, settingsJson, privateFlag]
    );

    res.json({ ok: true });
});

// GET /api/sync/:pluginName/public?userId=... — get a user's public config
app.get("/api/sync/:pluginName/public", async (req, res) => {
    const { userId } = req.query;
    const { pluginName } = req.params;

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const [configs] = await db.execute(
        "SELECT settings FROM plugin_configs WHERE discord_id = ? AND plugin_name = ? AND is_private = 0",
        [userId, pluginName]
    );

    if (configs.length === 0) return res.json({ settings: null });
    res.json({ settings: typeof configs[0].settings === "string" ? JSON.parse(configs[0].settings) : configs[0].settings });
});

// ---------------------------------------------------------------------------
// Telemetry endpoint (optional, for tracking active users)
// ---------------------------------------------------------------------------

app.post("/api/telemetry/ping", async (req, res) => {
    const { version, platform } = req.body;
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = parseInt(PORT, 10);
app.listen(port, () => {
    console.log(`[YouCord Server] listening on :${port}`);
    console.log(`[YouCord Server] OAuth2 redirect URI: ${REDIRECT_URI}`);
});
