/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { geminiProvider } from "./providers/gemini";
import { groqProvider } from "./providers/groq";
import { ollamaProvider } from "./providers/ollama";
import {
    getCurrentModel,
    getCurrentProvider,
    getProviderPreference,
    groqChat as registryGroqChat,
    setProviderPreference,
} from "./providers/registry";
import type { ChatCallOptions, GroqChatMessage, ProviderName } from "./providers/types";

export type { ChatCallOptions, GroqChatMessage, ProviderName };

const logger = new Logger("GroqManager");

// Backward-compatible settings fallback registration
let _settingsFallback: (() => string) | null = null;

export function registerSettingsFallback(fn: () => string) {
    _settingsFallback = fn;
    groqProvider.setSettingsFallback(fn);
}

// Groq API key
export async function getGroqKey(): Promise<string> {
    return groqProvider.getApiKey();
}

export async function setGroqKey(key: string): Promise<void> {
    await groqProvider.setApiKey(key);
}

// Gemini API key
export async function getGeminiKey(): Promise<string> {
    return geminiProvider.getApiKey();
}

export async function setGeminiKey(key: string): Promise<void> {
    await geminiProvider.setApiKey(key);
}

// Ollama URL + model
export async function getOllamaUrl(): Promise<string> {
    return ollamaProvider.getUrl();
}

export async function setOllamaUrl(url: string): Promise<void> {
    await ollamaProvider.setUrl(url);
}

export async function getOllamaModel(): Promise<string> {
    return ollamaProvider.getModel();
}

export async function setOllamaModel(model: string): Promise<void> {
    await ollamaProvider.setModel(model);
}

export async function fetchOllamaModels(): Promise<string[]> {
    return ollamaProvider.fetchAvailableModels();
}

// Provider preference
export { getProviderPreference, setProviderPreference };

// Current provider / model info
export { getCurrentModel,getCurrentProvider };

// Check if any key is configured
export async function hasAnyAIKey(): Promise<boolean> {
    const [groq, gemini] = await Promise.all([getGroqKey(), getGeminiKey()]);
    return !!(groq || gemini);
}

// Main chat entry point — delegates to registry (unchanged signature)
export async function groqChat(opts: { messages: GroqChatMessage[]; temperature?: number; maxTokens?: number; forceModel?: string; maxRetries?: number; }): Promise<string> {
    return registryGroqChat(opts);
}
