"use strict";

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
        ? { rejectUnauthorized: false }
        : undefined
});

async function initSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS oauth_sessions (
            state             TEXT PRIMARY KEY,
            status            TEXT NOT NULL DEFAULT 'pending',
            discord_id        TEXT,
            discord_username  TEXT,
            session_token     TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            discord_id            TEXT PRIMARY KEY,
            discord_username      TEXT,
            session_token         TEXT UNIQUE,
            stripe_customer_id    TEXT,
            stripe_subscription_id TEXT,
            premium               BOOLEAN NOT NULL DEFAULT false,
            premium_since         TIMESTAMPTZ,
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_session_token ON users (session_token);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users (stripe_customer_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users (stripe_subscription_id);`);
}

// Nettoie les sessions OAuth de plus de 15 minutes (flow abandonne / expire)
async function cleanupOldSessions() {
    await pool.query(`DELETE FROM oauth_sessions WHERE created_at < now() - interval '15 minutes'`);
}

module.exports = { pool, initSchema, cleanupOldSessions };
