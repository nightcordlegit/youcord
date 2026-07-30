/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ProviderName = "groq" | "gemini" | "ollama";

export interface GroqChatMessage {
    role: "system" | "user" | "assistant";
    content: string | any[];
}

export interface ChatCallOptions {
    temperature?: number;
    maxTokens?: number;
    forceModel?: string;
    maxRetries?: number;
    /** @internal Retry counter for rate-limit fallback */
    _retryCount?: number;
}

export interface ChatProvider {
    readonly name: ProviderName;
    chat(messages: GroqChatMessage[], opts: ChatCallOptions): Promise<string>;
    isAvailable(): boolean;
}
