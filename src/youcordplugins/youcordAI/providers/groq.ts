/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import { ChatCallOptions, ChatProvider, GroqChatMessage, ProviderName } from "./types";

const logger = new Logger("GroqProvider");

const DS_API_KEY = "groq-shared-api-key";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
] as const;

export class GroqProvider implements ChatProvider {
    readonly name: ProviderName = "groq";
    private currentModelIdx = 0;
    private modelCooldown: Record<string, number> = {};
    private _settingsFallback: (() => string) | null = null;

    setSettingsFallback(fn: () => string) {
        this._settingsFallback = fn;
    }

    isAvailable(): boolean {
        return true;
    }

    async getApiKey(): Promise<string> {
        const key = await DataStore.get(DS_API_KEY);
        if (typeof key === "string" && key.trim()) return key.trim();

        if (this._settingsFallback) {
            try {
                const fallback = this._settingsFallback();
                if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
            } catch { }
        }
        return "";
    }

    async setApiKey(key: string): Promise<void> {
        await DataStore.set(DS_API_KEY, key.trim());
    }

    getCurrentModel(): string {
        return GROQ_MODELS[this.currentModelIdx] ?? GROQ_MODELS[0];
    }

    private getAvailableModel(): string {
        const now = Date.now();
        for (let i = 0; i < GROQ_MODELS.length; i++) {
            const idx = (this.currentModelIdx + i) % GROQ_MODELS.length;
            const model = GROQ_MODELS[idx];
            if (now >= (this.modelCooldown[model] ?? 0)) {
                this.currentModelIdx = idx;
                return model;
            }
        }
        let minCooldown = Infinity;
        let bestIdx = 0;
        for (let i = 0; i < GROQ_MODELS.length; i++) {
            const cd = this.modelCooldown[GROQ_MODELS[i]] ?? 0;
            if (cd < minCooldown) { minCooldown = cd; bestIdx = i; }
        }
        this.currentModelIdx = bestIdx;
        return GROQ_MODELS[bestIdx];
    }

    private markRateLimited(model: string, retryAfterMs = 60_000): void {
        this.modelCooldown[model] = Date.now() + retryAfterMs;
        this.currentModelIdx = (this.currentModelIdx + 1) % GROQ_MODELS.length;
    }

    async chat(messages: GroqChatMessage[], opts: ChatCallOptions): Promise<string> {
        const { temperature = 0.7, maxTokens = 1000, forceModel, maxRetries = 3, reasoningEffort } = opts;

        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw Object.assign(new Error("Groq API key missing"), { __rateLimited: true });
        }

        const model = forceModel ?? this.getAvailableModel();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    temperature,
                    max_tokens: maxTokens,
                    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
                    messages,
                }),
                signal: controller.signal,
            });

            if (res.status === 429) {
                const retryAfterHeader = res.headers.get("retry-after");
                let retryAfterMs = 60_000;
                if (retryAfterHeader) {
                    const parsed = parseInt(retryAfterHeader, 10);
                    if (!isNaN(parsed) && parsed > 0) retryAfterMs = Math.min(300_000, parsed * 1000);
                }
                this.markRateLimited(model, retryAfterMs);

                const currentRetries = (opts as any)._retryCount ?? 0;
                if (currentRetries < maxRetries) {
                    return this.chat(messages, { ...opts, _retryCount: currentRetries + 1, forceModel: undefined });
                }
                throw Object.assign(new Error("Groq rate limit exceeded"), { __rateLimited: true });
            }

            if (!res.ok) {
                const body = await res.text().catch(() => "");
                throw new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
            }

            const data = await res.json().catch(() => null);
            if (!data || typeof data !== "object") throw new Error("Invalid response JSON from Groq");

            const content = data.choices?.[0]?.message?.content;
            if (typeof content !== "string") throw new Error("Groq response did not return valid content");

            return content.trim();
        } catch (err: any) {
            if (err.name === "AbortError") {
                throw Object.assign(new Error("Groq API request timed out"), { __rateLimited: true });
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export const groqProvider = new GroqProvider();
