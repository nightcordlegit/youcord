/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { API_BASE, checkOAuthToken, getStoredToken } from "@api/OAuth2";

export interface PremiumStatus {
    discordId: string;
    username: string;
    premium: boolean;
    premiumSince: string | null;
}

/** Poll /api/oauth2/check until the Discord login (opened in the browser) completes. */
export async function waitForOAuthCompletion(state: string, timeoutMs = 5 * 60 * 1000): Promise<{ sessionToken: string; discordId: string; username: string; } | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const result = await checkOAuthToken(state);
        if (result?.status === "complete") {
            return {
                sessionToken: result.sessionToken,
                discordId: result.discordId,
                username: result.username
            };
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    return null;
}

export async function fetchPremiumStatus(): Promise<PremiumStatus | null> {
    const token = await getStoredToken();
    if (!token) return null;

    try {
        const res = await fetch(`${API_BASE}/api/premium/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("[YouCordPremium] Failed to fetch premium status:", e);
        return null;
    }
}

export async function createCheckoutSession(): Promise<string | null> {
    const token = await getStoredToken();
    if (!token) return null;

    try {
        const res = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.url ?? null;
    } catch (e) {
        console.error("[YouCordPremium] Failed to create checkout session:", e);
        return null;
    }
}

export async function createBillingPortalSession(): Promise<string | null> {
    const token = await getStoredToken();
    if (!token) return null;

    try {
        const res = await fetch(`${API_BASE}/api/stripe/create-portal-session`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.url ?? null;
    } catch (e) {
        console.error("[YouCordPremium] Failed to create billing portal session:", e);
        return null;
    }
}
