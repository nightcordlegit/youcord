/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
import { join } from "path";

import { USER_AGENT } from "../constants";
import { VENCORD_DIR, VENCORD_FALLBACK_DIR } from "../vencordDir";
import { downloadFile, fetchie } from "./http";

const API_BASE = "https://api.github.com/repos/nightcordlegit/youcord";

export interface ReleaseData {
    name: string;
    tag_name: string;
    html_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

export async function githubGet(endpoint: string) {
    const opts: RequestInit = {
        headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": USER_AGENT
        }
    };

    return fetchie(API_BASE + endpoint, opts, { retryOnNetworkError: true });
}

export async function downloadVencordAsar() {
    const target = VENCORD_FALLBACK_DIR ?? VENCORD_DIR;
    await downloadFile(
        "https://github.com/nightcordlegit/youcord/releases/download/latest/YouCord.asar",
        target,
        {},
        { retryOnNetworkError: true }
    );
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "main.js"));
}

export async function ensureVencordFiles() {
    if (existsSync(VENCORD_DIR)) return;
    if (VENCORD_FALLBACK_DIR && existsSync(VENCORD_FALLBACK_DIR)) return;
    try {
        console.log("[YouCord] youcord.asar not found, downloading...");
        await downloadVencordAsar();
    } catch (e) {
        console.log("[YouCord] Failed to download youcord.asar:", e);
    }
}

export function getVencordPath(): string {
    if (existsSync(VENCORD_DIR)) return VENCORD_DIR;
    if (VENCORD_FALLBACK_DIR && existsSync(VENCORD_FALLBACK_DIR)) return VENCORD_FALLBACK_DIR;
    return VENCORD_DIR;
}
