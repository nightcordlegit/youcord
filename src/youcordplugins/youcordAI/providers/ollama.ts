/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import { ChatCallOptions, ChatProvider, GroqChatMessage, ProviderName } from "./types";

const logger = new Logger("OllamaProvider");

const DS_OLLAMA_URL = "ollama-url";
const DS_OLLAMA_MODEL = "ollama-model";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export class OllamaProvider implements ChatProvider {
    readonly name: ProviderName = "ollama";

    isAvailable(): boolean {
        return true;
    }

    async getUrl(): Promise<string> {
        const url = await DataStore.get(DS_OLLAMA_URL);
        return typeof url === "string" && url.trim() ? url.trim() : DEFAULT_OLLAMA_URL;
    }

    async setUrl(url: string): Promise<void> {
        await DataStore.set(DS_OLLAMA_URL, url.trim());
    }

    async getModel(): Promise<string> {
        const model = await DataStore.get(DS_OLLAMA_MODEL);
        return typeof model === "string" ? model.trim() : "";
    }

    async setModel(model: string): Promise<void> {
        await DataStore.set(DS_OLLAMA_MODEL, model.trim());
    }

    async fetchAvailableModels(): Promise<string[]> {
        try {
            const baseUrl = await this.getUrl();
            const cleanUrl = baseUrl.replace(/\/+$/, "");
            const res = await fetch(`${cleanUrl}/api/tags`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data?.models && Array.isArray(data.models)) {
                return data.models.map((m: any) => m.name);
            }
            return [];
        } catch (e) {
            logger.error("Failed to fetch Ollama models:", e);
            return [];
        }
    }

    async chat(messages: GroqChatMessage[], opts: ChatCallOptions): Promise<string> {
        const { temperature = 0.7, maxTokens = 1000, forceModel } = opts;

        const baseUrl = (await this.getUrl()).replace(/\/+$/, "");
        const model = forceModel || (await this.getModel()) || "llama3.2";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60_000);

        try {
            const res = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model,
                    temperature,
                    max_tokens: maxTokens,
                    messages,
                    stream: false,
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const body = await res.text().catch(() => "");
                throw new Error(`Ollama API ${res.status}: ${body.slice(0, 200)}`);
            }

            const data = await res.json().catch(() => null);
            if (!data || typeof data !== "object") throw new Error("Invalid response JSON from Ollama");

            const content = data.choices?.[0]?.message?.content;
            if (typeof content !== "string") throw new Error("Ollama response did not return valid content");

            return content.trim();
        } catch (err: any) {
            if (err.name === "AbortError") {
                throw new Error("Ollama request timed out after 60 seconds");
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export const ollamaProvider = new OllamaProvider();
