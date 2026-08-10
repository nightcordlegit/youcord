/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const settings = definePluginSettings({
    minDelayMs: {
        type: OptionType.NUMBER,
        description: "Minimum delay between Discord REST requests (ms)",
        default: 400,
    },
    maxReqPerMin: {
        type: OptionType.NUMBER,
        description: "Hard cap of requests per minute (0 = unlimited)",
        default: 0,
    },
    pauseOn429: {
        type: OptionType.BOOLEAN,
        description: "Automatically pause all requests after a 429 (rate limit)",
        default: true,
    },
});

// ── État global ────────────────────────────────────────────────────────────────

let api: any = null;
let originals: Record<string, any> = {};
let wrapped = false;

let chain: Promise<any> = Promise.resolve();
let lastSentAt = 0;
let globalUntil = 0;
let windowStart = Date.now();
let windowCount = 0;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = chain.then(fn);
    chain = result.then(() => undefined, () => undefined);
    return result;
}

async function waitTurn(): Promise<void> {
    if (!settings.store.pauseOn429) return;

    // Pause globale déclenchée par un 429
    const now = Date.now();
    if (globalUntil > now) {
        await sleep(globalUntil - now);
    }

    // Fenêtre glissante : plafond req/min
    const windowMs = 60_000;
    if (windowStart + windowMs < Date.now()) {
        windowStart = Date.now();
        windowCount = 0;
    }
    const cap = settings.store.maxReqPerMin;
    if (cap > 0 && windowCount >= cap) {
        const waitMs = windowStart + windowMs - Date.now();
        if (waitMs > 0) await sleep(waitMs);
        windowStart = Date.now();
        windowCount = 0;
    }
    windowCount++;

    // Espacement minimal entre deux requêtes (avec jitter ±20 %)
    const base = Math.max(0, settings.store.minDelayMs ?? 0);
    const gap = base * (0.8 + Math.random() * 0.4);
    const target = Math.max(lastSentAt + gap, Date.now());
    const wait = target - Date.now();
    if (wait > 0) await sleep(wait);
    lastSentAt = Date.now();
}

function maybeHandle429(status?: number, resOrErr?: any): void {
    if (status !== 429) return;
    if (!settings.store.pauseOn429) return;

    let seconds = 5;
    let isGlobal = false;
    try {
        const headers = resOrErr?.headers;
        const ra = headers?.get?.("retry-after") ?? headers?.get?.("Retry-After") ?? resOrErr?.retryAfter;
        if (ra != null) {
            const n = Number(ra);
            if (Number.isFinite(n) && n > 0) seconds = n;
        }
        isGlobal = headers?.get?.("x-ratelimit-global") === "true" || !!resOrErr?.global;
    } catch { }
    if (isGlobal) seconds = Math.max(seconds, 30);

    const until = Date.now() + seconds * 1000 + 250;
    if (until > globalUntil) globalUntil = until;
    console.warn(`[RateShield] 429 detected${isGlobal ? " (global)" : ""} — pausing all Discord REST requests for ${seconds}s`);
}

function guarded(op: string, orig: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
    return enqueue(async () => {
        await waitTurn();
        try {
            const res = await orig(...args);
            maybeHandle429(res?.status, res);
            return res;
        } catch (e: any) {
            const status = e?.status ?? e?.statusCode ?? e?.response?.status;
            maybeHandle429(status, e);
            throw e;
        }
    });
}

function wrapApi(): void {
    if (!api || wrapped) return;
    const ops = ["get", "post", "patch", "put", "del"] as const;
    for (const op of ops) {
        if (typeof api[op] !== "function") continue;
        originals[op] = api[op];
        const orig = api[op].bind(api);
        api[op] = ((...args: any[]) => guarded(op, orig, ...args)) as any;
    }
    wrapped = true;
    console.log("[RateShield] REST guard active — queue enabled");
}

function unwrapApi(): void {
    if (!api || !wrapped) return;
    for (const op of Object.keys(originals)) {
        if (typeof originals[op] === "function") api[op] = originals[op];
    }
    originals = {};
    wrapped = false;
    globalUntil = 0;
    console.log("[RateShield] REST guard removed");
}

export default definePlugin({
    name: "RateShield",
    enabledByDefault: true,
    description: "Protects your account from Discord rate limits: request queue, 429 auto-pause, per-minute cap.",
    authors: [{ name: "YouCord", id: 0n }],

    settings,

    async start() {
        try {
            api = findByPropsLazy("post", "patch", "del");
            wrapApi();
        } catch (e) {
            console.warn("[RateShield] REST module not found yet:", e);
        }
    },

    stop() {
        unwrapApi();
    },
});
