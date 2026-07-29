/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

const logger = new Logger("GroqManager");

const DS_API_KEY = "groq-shared-api-key";
const DS_GEMINI_API_KEY = "gemini-shared-api-key";
const DS_PROVIDER_PREF = "ai-provider-preference"; // "auto" | "groq" | "gemini"

const GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama3-70b-8192",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
] as const;

// Free-tier Gemini models (gemini-2.0-flash was retired March 2026).
const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
] as const;

type Provider = "groq" | "gemini";

let currentGroqModelIdx = 0;
let currentGeminiModelIdx = 0;
const groqModelCooldown: Record<string, number> = {};
const geminiModelCooldown: Record<string, number> = {};

// Per-provider cooldown — set when every model of that provider is rate-limited.
const providerCooldown: Record<Provider, number> = { groq: 0, gemini: 0 };
// Sticky preference so we don't ping-pong between providers on every call.
let preferredProvider: Provider = "groq";

let _settingsFallback: (() => string) | null = null;

export function registerSettingsFallback(fn: () => string) {
    _settingsFallback = fn;
}

export async function getGroqKey(): Promise<string> {
    const key = await DataStore.get(DS_API_KEY);
    if (typeof key === "string" && key.trim()) {
        return key.trim();
    }
    if (_settingsFallback) {
        try {
            const fallback = _settingsFallback();
            if (typeof fallback === "string" && fallback.trim()) {
                return fallback.trim();
            }
        } catch (err) {
            logger.error("Failed to run settings fallback function", err);
        }
    }
    return "";
}

export async function setGroqKey(key: string): Promise<void> {
    if (typeof key !== "string") {
        throw new Error("API key must be a string");
    }
    await DataStore.set(DS_API_KEY, key.trim());
}

export async function getGeminiKey(): Promise<string> {
    const key = await DataStore.get(DS_GEMINI_API_KEY);
    if (typeof key === "string" && key.trim()) {
        return key.trim();
    }
    return "";
}

export async function setGeminiKey(key: string): Promise<void> {
    if (typeof key !== "string") {
        throw new Error("API key must be a string");
    }
    await DataStore.set(DS_GEMINI_API_KEY, key.trim());
}

export async function hasAnyAIKey(): Promise<boolean> {
    const [groq, gemini] = await Promise.all([getGroqKey(), getGeminiKey()]);
    return !!(groq || gemini);
}

export type ProviderPreference = "auto" | Provider;

export async function getProviderPreference(): Promise<ProviderPreference> {
    const pref = await DataStore.get(DS_PROVIDER_PREF);
    if (pref === "groq" || pref === "gemini") return pref;
    return "auto";
}

export async function setProviderPreference(pref: ProviderPreference): Promise<void> {
    await DataStore.set(DS_PROVIDER_PREF, pref);
    if (pref !== "auto") preferredProvider = pref; // apply immediately, don't wait for next pick
}

export function getCurrentProvider(): Provider {
    return preferredProvider;
}

// ── Model rotation within a single provider (unchanged logic, per-provider) ──────────

function getAvailableGroqModel(): string {
    const now = Date.now();
    for (let i = 0; i < GROQ_MODELS.length; i++) {
        const idx = (currentGroqModelIdx + i) % GROQ_MODELS.length;
        const model = GROQ_MODELS[idx];
        if (now >= (groqModelCooldown[model] ?? 0)) {
            currentGroqModelIdx = idx;
            return model;
        }
    }
    let minCooldown = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < GROQ_MODELS.length; i++) {
        const cd = groqModelCooldown[GROQ_MODELS[i]] ?? 0;
        if (cd < minCooldown) { minCooldown = cd; bestIdx = i; }
    }
    currentGroqModelIdx = bestIdx;
    return GROQ_MODELS[bestIdx];
}

function getAvailableGeminiModel(): string {
    const now = Date.now();
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const idx = (currentGeminiModelIdx + i) % GEMINI_MODELS.length;
        const model = GEMINI_MODELS[idx];
        if (now >= (geminiModelCooldown[model] ?? 0)) {
            currentGeminiModelIdx = idx;
            return model;
        }
    }
    let minCooldown = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const cd = geminiModelCooldown[GEMINI_MODELS[i]] ?? 0;
        if (cd < minCooldown) { minCooldown = cd; bestIdx = i; }
    }
    currentGeminiModelIdx = bestIdx;
    return GEMINI_MODELS[bestIdx];
}

function markGroqModelRateLimited(model: string, retryAfterMs = 60_000): void {
    groqModelCooldown[model] = Date.now() + retryAfterMs;
    currentGroqModelIdx = (currentGroqModelIdx + 1) % GROQ_MODELS.length;
    // If every Groq model is now cooling down, put the whole provider on cooldown
    // so pickProvider() skips straight to Gemini instead of retrying uselessly.
    const now = Date.now();
    if (GROQ_MODELS.every(m => (groqModelCooldown[m] ?? 0) > now)) {
        const soonest = Math.min(...GROQ_MODELS.map(m => groqModelCooldown[m] ?? 0));
        providerCooldown.groq = soonest;
        logger.warn("All Groq models rate-limited — provider on cooldown");
    }
}

function markGeminiModelRateLimited(model: string, retryAfterMs = 60_000): void {
    geminiModelCooldown[model] = Date.now() + retryAfterMs;
    currentGeminiModelIdx = (currentGeminiModelIdx + 1) % GEMINI_MODELS.length;
    const now = Date.now();
    if (GEMINI_MODELS.every(m => (geminiModelCooldown[m] ?? 0) > now)) {
        const soonest = Math.min(...GEMINI_MODELS.map(m => geminiModelCooldown[m] ?? 0));
        providerCooldown.gemini = soonest;
        logger.warn("All Gemini models rate-limited — provider on cooldown");
    }
}

// ── Provider selection ──────────────────────────────────────────────────────────

async function pickProvider(exclude?: Provider): Promise<Provider | null> {
    const [groqKey, geminiKey, pref] = await Promise.all([getGroqKey(), getGeminiKey(), getProviderPreference()]);
    const now = Date.now();

    const candidates: Provider[] = [];
    if (groqKey && provider_not_excluded("groq", exclude) && now >= providerCooldown.groq) candidates.push("groq");
    if (geminiKey && provider_not_excluded("gemini", exclude) && now >= providerCooldown.gemini) candidates.push("gemini");

    if (candidates.length > 0) {
        // A manually forced provider (not "auto") wins as long as it's actually
        // available right now; otherwise fall back to the sticky auto-preference.
        if (pref !== "auto" && candidates.includes(pref)) {
            preferredProvider = pref;
            return preferredProvider;
        }
        if (candidates.includes(preferredProvider)) return preferredProvider;
        preferredProvider = candidates[0];
        return preferredProvider;
    }

    // Nothing available right now (both cooling down, or excluded) — fall back to
    // whichever configured key isn't the excluded one, even mid-cooldown, so the
    // user still gets *an* attempt instead of a hard failure.
    if (groqKey && exclude !== "groq") return "groq";
    if (geminiKey && exclude !== "gemini") return "gemini";
    return null;
}

function provider_not_excluded(p: Provider, exclude?: Provider) {
    return exclude !== p;
}

// ── Shared message format ──────────────────────────────────────────────────────

export interface GroqChatMessage {
    role: "system" | "user" | "assistant";
    content: string | any[];
}

export interface GroqCallOptions {
    messages: GroqChatMessage[];
    temperature?: number;
    maxTokens?: number;
    forceModel?: string;
    maxRetries?: number;
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

// ── Public entry point — kept as "groqChat" for backward compatibility: every
// plugin (Dmserveur, AutoCorrect, VoiceDictation, YouCordAI) already imports this
// name, so switching providers under the hood needs zero changes on their side.
export async function groqChat(opts: GroqCallOptions): Promise<string> {
    if (!opts || typeof opts !== "object") {
        throw new Error("Invalid options object");
    }
    if (!Array.isArray(opts.messages)) {
        throw new Error("Messages must be an array");
    }
    for (const msg of opts.messages) {
        if (!msg || typeof msg !== "object") {
            throw new Error("Invalid message object");
        }
        if (msg.role !== "system" && msg.role !== "user" && msg.role !== "assistant") {
            throw new Error(`Invalid message role: ${msg.role}`);
        }
        if (typeof msg.content !== "string" && !Array.isArray(msg.content)) {
            throw new Error("Message content must be a string or array");
        }
    }
    return enqueue(() => _dispatch(opts));
}

async function _dispatch(opts: GroqCallOptions, attempt = 0, excludeProvider?: Provider): Promise<string> {
    const maxProviderSwitches = 2; // groq -> gemini -> (give up)

    const provider = await pickProvider(excludeProvider);
    if (!provider) {
        throw new Error("No AI API key configured — add a Groq and/or Gemini key in Settings → YouCordAI");
    }

    try {
        if (provider === "groq") {
            // forceModel is provider-specific. Gemini model names always start with
            // "gemini"; anything else is assumed to be a Groq model name. Don't
            // forward a Gemini-shaped model into a Groq call (or vice versa) if we
            // ever fail over between providers mid-request.
            const groqOpts = opts.forceModel?.startsWith("gemini")
                ? { ...opts, forceModel: undefined }
                : opts;
            return await _groqChat(groqOpts);
        } else {
            const geminiOpts = opts.forceModel && !opts.forceModel.startsWith("gemini")
                ? { ...opts, forceModel: undefined }
                : opts;
            return await _geminiChat(geminiOpts);
        }
    } catch (err: any) {
        const isRateLimit = err?.__rateLimited === true;
        if (isRateLimit && attempt < maxProviderSwitches) {
            logger.warn(`${provider} rate-limited, switching provider`);
            return _dispatch(opts, attempt + 1, provider);
        }
        throw err;
    }
}

// ── Groq ─────────────────────────────────────────────────────────────────────

async function _groqChat(opts: GroqCallOptions, attempt = 0): Promise<string> {
    const { messages, temperature = 0.7, maxTokens = 1000, forceModel, maxRetries = 3 } = opts;

    const apiKey = await getGroqKey();
    if (!apiKey) {
        const err: any = new Error("Groq API key missing");
        err.__rateLimited = true; // treat "no key" like "unavailable" so we try Gemini instead
        throw err;
    }

    const model = forceModel ?? getAvailableGroqModel();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature,
                max_tokens: maxTokens,
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
            markGroqModelRateLimited(model, retryAfterMs);

            if (attempt < maxRetries) {
                return _groqChat({ ...opts, forceModel: undefined }, attempt + 1);
            }
            const err: any = new Error("Groq rate limit — switching provider if possible");
            err.__rateLimited = true;
            throw err;
        }

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
        }

        const data = await res.json().catch(() => null);
        if (!data || typeof data !== "object") {
            throw new Error("Invalid response JSON from Groq");
        }

        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
            throw new Error("Groq response did not return a valid content string");
        }

        return content.trim();
    } catch (err: any) {
        if (err.name === "AbortError") {
            const timeoutErr: any = new Error("Groq API request timed out after 30 seconds");
            timeoutErr.__rateLimited = true; // let it fail over to Gemini rather than dead-end
            throw timeoutErr;
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ── Gemini ─────────────────────────────────────────────────────────────

function toGeminiPayload(messages: GroqChatMessage[]) {
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

        // Multimodal content (text + images), same shape used for Groq vision calls.
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

async function _geminiChat(opts: GroqCallOptions, attempt = 0): Promise<string> {
    const { messages, temperature = 0.7, maxTokens = 1000, forceModel, maxRetries = 3 } = opts;

    const apiKey = await getGeminiKey();
    if (!apiKey) {
        const err: any = new Error("Gemini API key missing");
        err.__rateLimited = true;
        throw err;
    }

    const model = forceModel ?? getAvailableGeminiModel();
    const { contents, systemInstruction } = toGeminiPayload(messages);

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
            markGeminiModelRateLimited(model, 60_000);
            if (attempt < maxRetries) {
                return _geminiChat({ ...opts, forceModel: undefined }, attempt + 1);
            }
            const err: any = new Error("Gemini rate limit — switching provider if possible");
            err.__rateLimited = true;
            throw err;
        }

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
        }

        const data = await res.json().catch(() => null);
        if (!data || typeof data !== "object") {
            throw new Error("Invalid response JSON from Gemini");
        }

        const parts = data.candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") : "";
        if (!text) {
            // Gemini returns no candidates when its safety filters block a prompt —
            // surface that distinctly instead of a blank/confusing error.
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
            }
            throw new Error("Gemini response did not return any text");
        }

        return text.trim();
    } catch (err: any) {
        if (err.name === "AbortError") {
            const timeoutErr: any = new Error("Gemini API request timed out after 30 seconds");
            timeoutErr.__rateLimited = true;
            throw timeoutErr;
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function getCurrentModel(): string {
    return preferredProvider === "gemini"
        ? (GEMINI_MODELS[currentGeminiModelIdx] ?? GEMINI_MODELS[0])
        : (GROQ_MODELS[currentGroqModelIdx] ?? GROQ_MODELS[0]);
}
