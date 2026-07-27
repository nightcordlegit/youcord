/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { net } from "electron";

export async function botFetch(_event: Electron.IpcMainInvokeEvent, token: string, url: string, options?: { method?: string; body?: string }) {
    const headers: Record<string, string> = {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
    };

    const res = await net.fetch(url, {
        method: options?.method ?? "GET",
        headers,
        body: options?.body,
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }
    return JSON.parse(text);
}
