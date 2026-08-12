/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { ollamaProvider } from "./ollama";
import { ChatCallOptions, ChatProvider, GroqChatMessage, ProviderName } from "./types";

const logger = new Logger("ProviderRegistry");

const DS_PROVIDER_PREF = "ai-provider-preference";

type ProviderPreference = "auto" | ProviderName;

const providers = new Map<ProviderName, ChatProvider>([
    ["groq", groqProvider],
    ["gemini", geminiProvider],
    ["ollama", ollamaProvider],
]);

let preferredProvider: ProviderName = "groq";

// Per-provider cooldown for Groq↔Gemini auto-fallback
const providerCooldown: Record<ProviderName, number> = { groq: 0, gemini: 0, ollama: 0 };
const PROVIDER_SWITCH_MAX = 2;

export async function getProviderPreference(): Promise<ProviderPreference> {
    const pref = await DataStore.get(DS_PROVIDER_PREF);
    if (pref === "groq" || pref === "gemini" || pref === "ollama") return pref;
    return "auto";
}

export async function setProviderPreference(pref: ProviderPreference): Promise<void> {
    await DataStore.set(DS_PROVIDER_PREF, pref);
    if (pref !== "auto") preferredProvider = pref;
}

export function getCurrentProvider(): ProviderName {
    return preferredProvider;
}

export function getCurrentModel(): string {
    if (preferredProvider === "gemini") return geminiProvider.getCurrentModel();
    if (preferredProvider === "ollama") return "local";
    return groqProvider.getCurrentModel();
}

export function getGroqProvider() { return groqProvider; }
export function getGeminiProvider() { return geminiProvider; }
export function getOllamaProvider() { return ollamaProvider; }

async function pickProvider(exclude?: ProviderName): Promise<ChatProvider | null> {
    const [groqKey, geminiKey, pref] = await Promise.all([
        groqProvider.getApiKey(),
        geminiProvider.getApiKey(),
        getProviderPreference(),
    ]);
    const now = Date.now();

    if (pref === "ollama") {
        return ollamaProvider;
    }

    if (pref !== "auto") {
        const provider = providers.get(pref);
        if (provider && exclude !== pref) {
            if (now >= (providerCooldown[pref] ?? 0)) {
                preferredProvider = pref;
                return provider;
            }
        }
        // Selected provider is on cooldown → try the other one
        const fallback = pref === "groq" ? geminiProvider : groqProvider;
        const fallbackName = pref === "groq" ? "gemini" : "groq";
        if (exclude !== fallbackName && now >= (providerCooldown[fallbackName] ?? 0)) {
            return fallback;
        }
        return null;
    }

    // Auto mode: try groq first, fall back to gemini
    if (groqKey && exclude !== "groq" && now >= (providerCooldown.groq ?? 0)) {
        preferredProvider = "groq";
        return groqProvider;
    }
    if (geminiKey && exclude !== "gemini" && now >= (providerCooldown.gemini ?? 0)) {
        preferredProvider = "gemini";
        return geminiProvider;
    }

    // Both on cooldown or excluded — force fallback even during cooldown
    if (groqKey && exclude !== "groq") {
        preferredProvider = "groq";
        return groqProvider;
    }
    if (geminiKey && exclude !== "gemini") {
        preferredProvider = "gemini";
        return geminiProvider;
    }

    return null;
}

function markProviderRateLimited(providerName: ProviderName) {
    providerCooldown[providerName] = Date.now() + 60_000;
}

async function dispatch(messages: GroqChatMessage[], opts: ChatCallOptions, attempt = 0, excludeProvider?: ProviderName): Promise<string> {
    const provider = await pickProvider(excludeProvider);
    if (!provider) {
        throw new Error("No AI provider available — configure an API key or Ollama in Settings → YouCordAI");
    }

    try {
        return await provider.chat(messages, opts);
    } catch (err: any) {
        if (err?.__rateLimited === true && attempt < PROVIDER_SWITCH_MAX && provider.name !== "ollama") {
            markProviderRateLimited(provider.name);
            logger.warn(`${provider.name} rate-limited, switching provider`);
            return dispatch(messages, opts, attempt + 1, provider.name);
        }
        throw err;
    }
}

let queue = Promise.resolve();
const MIN_DELAY_MS = 200;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(() => fn());
    queue = result.then(
        () => new Promise(r => setTimeout(r, MIN_DELAY_MS)),
        () => new Promise(r => setTimeout(r, MIN_DELAY_MS)),
    );
    return result;
}

export async function groqChat(opts: ChatCallOptions & { messages: GroqChatMessage[]; }): Promise<string> {
    const { messages, ...rest } = opts;
    if (!rest || typeof rest !== "object") throw new Error("Invalid options object");
    if (!Array.isArray(messages)) throw new Error("Messages must be an array");
    for (const msg of messages) {
        if (!msg || typeof msg !== "object") throw new Error("Invalid message object");
        if (msg.role !== "system" && msg.role !== "user" && msg.role !== "assistant") {
            throw new Error(`Invalid message role: ${msg.role}`);
        }
        if (typeof msg.content !== "string" && !Array.isArray(msg.content)) {
            throw new Error("Message content must be a string or array");
        }
    }
    return enqueue(() => dispatch(messages, rest));
}
