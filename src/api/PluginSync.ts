/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Enabled — connects to the YouCord server
export const PLUGIN_SYNC_AVAILABLE = true;

const YOUCORD_API = "https://api.youcord.fr";

export async function getOwnPluginConfig(pluginName: string, token: string) {
    if (!PLUGIN_SYNC_AVAILABLE) return null;

    const response = await fetch(`${YOUCORD_API}/api/sync/${encodeURIComponent(pluginName)}?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
        throw new Error("Failed to load plugin config");
    }
    return response.json();
}

export async function saveOwnPluginConfig(pluginName: string, token: string, settings: Record<string, unknown>) {
    if (!PLUGIN_SYNC_AVAILABLE) return null;

    // private must be sent both at top-level and inside settings so the server
    // always treats this config as public (visible via /public endpoint).
    const isPrivate = settings.private === true;
    const response = await fetch(`${YOUCORD_API}/api/sync/${encodeURIComponent(pluginName)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            token,
            private: isPrivate,
            settings: { ...settings, private: isPrivate }
        })
    });

    if (!response.ok) {
        throw new Error("Failed to save plugin config");
    }

    return response.json();
}

// No in-memory cache here — caching is handled by callers (e.g. publicProfilesCache in customProfile)
export async function getPublicPluginConfig(pluginName: string, userId: string) {
    if (!PLUGIN_SYNC_AVAILABLE) return null;

    try {
        const response = await fetch(`${YOUCORD_API}/api/sync/${encodeURIComponent(pluginName)}/public?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error(`Failed to load public config for ${pluginName}/${userId}:`, e);
        return null;
    }
}

export function clearPublicProfileCache() {}
