/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Remplace cette URL par celle de ton service Railway une fois déployé
// (ex: "https://youcord-premium-production.up.railway.app"), puis repasse
// YOUCORD_OAUTH_AVAILABLE à true. Voir youcord-premium-server/README.md.
export const API_BASE = "https://REMPLACE-MOI.up.railway.app";
export const YOUCORD_OAUTH_AVAILABLE = true;

import * as DataStore from "./DataStore";

export const OAUTH_TOKEN_KEY = "youcord_oauth_token";

export async function beginDiscordOAuth(state?: string) {
    if (!YOUCORD_OAUTH_AVAILABLE) {
        throw new Error("YouCord OAuth is not available on this build");
    }
    const url = new URL(`${API_BASE}/api/oauth2/signing`);
    if (state) {
        url.searchParams.set("state", state);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error("Failed to create OAuth URL");
    }

    return response.json() as Promise<{
        url: string;
        redirectUri: string;
        scopes: string[];
    }>;
}

export async function checkOAuthToken(token: string) {
    if (!YOUCORD_OAUTH_AVAILABLE) return null;
    try {
        const response = await fetch(`${API_BASE}/api/oauth2/check?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (e) {
        console.error("Failed to check OAuth token:", e);
        return null;
    }
}

export async function getStoredToken(): Promise<string | null> {
    return (await DataStore.get(OAUTH_TOKEN_KEY)) || null;
}

export async function storeToken(token: string) {
    await DataStore.set(OAUTH_TOKEN_KEY, token);
}

export async function clearToken() {
    await DataStore.del(OAUTH_TOKEN_KEY);
}
