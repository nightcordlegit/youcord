/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface DiscordRequestOptions {
    minDelayMs?: number;
    maxRetries?: number;
}
let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function retryAfterMs(error: any, attempt: number): number | null {
    const status = error?.status
        ?? error?.statusCode
        ?? error?.httpStatus
        ?? error?.response?.status;
    if (status === 502 || status === 503 || status === 504) {
        return 1200 * (attempt + 1);
    }
    if (status !== 429) return null;

    const raw = error?.retryAfter
        ?? error?.body?.retry_after
        ?? error?.response?.body?.retry_after
        ?? error?.response?.headers?.["retry-after"]
        ?? error?.headers?.get?.("retry-after");
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 5000;
}

/**
 * Serialises only explicit YouCord bulk actions. It deliberately does not
 * patch Discord's HTTP client or ordinary Discord requests.
 */
export function runDiscordRequest<T>(
    request: () => Promise<T>,
    { minDelayMs = 1100, maxRetries = 2 }: DiscordRequestOptions = {}
): Promise<T> {
    const run = async () => {
        const elapsed = Date.now() - lastRequestAt;
        const jitteredDelay = minDelayMs + Math.random() * Math.min(300, minDelayMs * 0.2);
        if (elapsed < jitteredDelay) await sleep(jitteredDelay - elapsed);

        for (let attempt = 0; ; attempt++) {
            lastRequestAt = Date.now();
            try {
                return await request();
            } catch (error) {
                const retryMs = retryAfterMs(error, attempt);
                if (retryMs == null || attempt >= maxRetries) throw error;
                await sleep(retryMs + 250 + Math.random() * 250);
            }
        }
    };

    const result = queue.then(run, run);
    queue = result.then(() => undefined, () => undefined);
    return result;
}
