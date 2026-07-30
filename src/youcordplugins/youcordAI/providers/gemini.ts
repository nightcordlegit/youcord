/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import { ChatCallOptions, ChatProvider, GroqChatMessage, ProviderName } from "./types";

const logger = new Logger("GeminiProvider");

const DS_GEMINI_API_KEY = "gemini-shared-api-key";

const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
] as const;

export class GeminiProvider implements ChatProvider {
    readonly name: ProviderName = "gemini";
    private currentModelIdx = 0;
    private modelCooldown: Record<string, number> = {};

    isAvailable(): boolean {
        return true;
    }

    async getApiKey(): Promise<string> {
        const key = await DataStore.get(DS_GEMINI_API_KEY);
        return typeof key === "string" && key.trim() ? key.trim() : "";
    }

    async setApiKey(key: string): Promise<void> {
        await DataStore.set(DS_GEMINI_API_KEY, key.trim());
    }

    getCurrentModel(): string {
        return GEMINI_MODELS[this.currentModelIdx] ?? GEMINI_MODELS[0];
    }

    private getAvailableModel(): string {
        const now = Date.now();
        for (let i = 0; i < GEMINI_MODELS.length; i++) {
            const idx = (this.currentModelIdx + i) % GEMINI_MODELS.length;
            const model = GEMINI_MODELS[idx];
            if (now >= (this.modelCooldown[model] ?? 0)) {
                this.currentModelIdx = idx;
                return model;
            }
        }
        let minCooldown = Infinity;
        let bestIdx = 0;
        for (let i = 0; i < GEMINI_MODELS.length; i++) {
            const cd = this.modelCooldown[GEMINI_MODELS[i]] ?? 0;
            if (cd < minCooldown) { minCooldown = cd; bestIdx = i; }
        }
        this.currentModelIdx = bestIdx;
        return GEMINI_MODELS[bestIdx];
    }

    private markRateLimited(model: string, retryAfterMs = 60_000): void {
        this.modelCooldown[model] = Date.now() + retryAfterMs;
        this.currentModelIdx = (this.currentModelIdx + 1) % GEMINI_MODELS.length;
    }

    private toGeminiPayload(messages: GroqChatMessage[]) {
        const systemParts: string[] = [];
        const contents: any[] = [];

        for (const msg of messages) {
            if (msg.role === "system") {
                systemParts.push(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
                continue;
            }

            const role = msg.role === "assistant" ? "model" : "user";

            if (typeof msg.content === "string") {
                contents.push({ role, parts: [{ text: msg.content }] });
                continue;
            }

            const parts: any[] = [];
            for (const part of msg.content) {
                if (part?.type === "text" && typeof part.text === "string") {
                    parts.push({ text: part.text });
                } else if (part?.type === "image_url" && typeof part.image_url?.url === "string") {
                    const match = /^data:([^;]+);base64,(.+)$/.exec(part.image_url.url);
                    if (match) {
                        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                    }
                }
            }
            contents.push({ role, parts });
        }

        return {
            contents,
            systemInstruction: systemParts.length > 0 ? { parts: [{ text: systemParts.join("\n\n") }] } : undefined,
        };
    }

    async chat(messages: GroqChatMessage[], opts: ChatCallOptions): Promise<string> {
        const { temperature = 0.7, maxTokens = 1000, forceModel, maxRetries = 3 } = opts;

        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw Object.assign(new Error("Gemini API key missing"), { __rateLimited: true });
        }

        const model = forceModel ?? this.getAvailableModel();
        const { contents, systemInstruction } = this.toGeminiPayload(messages);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey,
                    },
                    body: JSON.stringify({
                        contents,
                        systemInstruction,
                        generationConfig: {
                            temperature,
                            maxOutputTokens: maxTokens,
                        },
                    }),
                    signal: controller.signal,
                },
            );

            if (res.status === 429) {
                this.markRateLimited(model, 60_000);
                const currentRetries = (opts as any)._retryCount ?? 0;
                if (currentRetries < maxRetries) {
                    return this.chat(messages, { ...opts, _retryCount: currentRetries + 1 });
                }
                throw Object.assign(new Error("Gemini rate limit exceeded"), { __rateLimited: true });
            }

            if (!res.ok) {
                const body = await res.text().catch(() => "");
                throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
            }

            const data = await res.json().catch(() => null);
            if (!data || typeof data !== "object") throw new Error("Invalid response JSON from Gemini");

            const parts = data.candidates?.[0]?.content?.parts;
            const text = Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") : "";
            if (!text) {
                if (data.promptFeedback?.blockReason) {
                    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
                }
                throw new Error("Gemini response did not return any text");
            }

            return text.trim();
        } catch (err: any) {
            if (err.name === "AbortError") {
                throw Object.assign(new Error("Gemini API request timed out"), { __rateLimited: true });
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export const geminiProvider = new GeminiProvider();
