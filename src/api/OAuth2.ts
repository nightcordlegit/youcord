/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";

export const YOUCORD_OAUTH_AVAILABLE = true;

/** Returns the YouCord server base URL from the user's cloud settings. */
export function getApiBase(): string {
    const url = Settings.cloud?.url;
    if (!url) return "";
    // Strip trailing slash
    return url.replace(/\/+$/, "");
}

import * as DataStore from "./DataStore";

export const OAUTH_TOKEN_KEY = "youcord_oauth_token";

export async function beginDiscordOAuth(state?: string) {
    const apiBase = getApiBase();
    if (!apiBase) {
        throw new Error("YouCord cloud URL is not configured");
    }

    const url = new URL(`${apiBase}/api/oauth2/signing`);
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
    const apiBase = getApiBase();
    if (!apiBase) return null;

    try {
        const response = await fetch(`${apiBase}/api/oauth2/check?token=${encodeURIComponent(token)}`);
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
