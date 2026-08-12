/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const BASE = "https://www.myinstants.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

export interface MyInstantResult {
    id: string;
    name: string;
    audioUrl: string;
    pageUrl: string;
}

function decodeHtml(value: string) {
    return value
        .replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&#x27;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function parseResults(html: string): MyInstantResult[] {
    const results: MyInstantResult[] = [];
    const pattern = /<button[^>]+class="small-button"[^>]+onclick="play\('([^']+)'[^,]*,[^,]*,\s*'([^']+)'\)"[\s\S]*?<a href="([^"]+)" class="instant-link[^>]*>([\s\S]*?)<\/a>/g;
    for (const match of html.matchAll(pattern)) {
        const [, audioPath, id, pagePath, rawName] = match;
        results.push({
            id,
            name: decodeHtml(rawName.replace(/<[^>]+>/g, "").trim()),
            audioUrl: new URL(audioPath, BASE).href,
            pageUrl: new URL(pagePath, BASE).href,
        });
        if (results.length >= 60) break;
    }
    return results;
}

export async function browse(query: string, category: string, page = 1): Promise<string> {
    const safePage = Math.max(1, Math.min(50, Math.trunc(page)));
    let url: URL;
    if (query.trim()) {
        url = new URL("/en/search/", BASE);
        url.searchParams.set("name", query.trim().slice(0, 100));
    } else {
        const allowed = new Set(["sound effects", "memes", "games", "reactions", "viral", "anime & manga", "movies", "television", "sports", "pranks"]);
        const selected = allowed.has(category) ? category : "sound effects";
        url = new URL(`/en/categories/${encodeURIComponent(selected)}/us/`, BASE);
    }
    url.searchParams.set("page", String(safePage));

    const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!response.ok) throw new Error(`MyInstants HTTP ${response.status}`);
    return JSON.stringify(parseResults(await response.text()));
}
