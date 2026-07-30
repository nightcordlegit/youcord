/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { transcribeCustom } from "./backends/customApi";
import { transcribeGroq } from "./backends/groq";
import { transcribeLocal } from "./backends/local";

export type SttBackend = "groq" | "local" | "custom";

export interface TranscribeOpts {
    backend: SttBackend;
    blob: Blob;
    language?: string;
    customApiUrl?: string;
    customApiKey?: string;
    customModel?: string;
}

export function isHallucination(text: string): boolean {
    const t = text.trim();
    if (!t) return true;

    return (
        /^(merci|thanks?|thank you|music|♪|🎵|\.\.\.|\.\s*)+$/i.test(t) ||
        /sous[- ]?titr/i.test(t) ||
        /radio[- ]?canada|société radio/i.test(t) ||
        /merci .*(regard|écouter|suivi)|thanks? .*watch/i.test(t) ||
        /transcri(ption|t)\s*(par|by)/i.test(t) ||
        /^(.{1,15})\1{2,}$/i.test(t.replace(/\s+/g, "")) ||
        /^[\s.,!?…\-–—]+$/.test(t)
    );
}

export async function transcribe(opts: TranscribeOpts): Promise<string> {
    const { backend, blob, language } = opts;

    let text: string;

    switch (backend) {
        case "groq":
            text = await transcribeGroq(blob, { language });
            break;
        case "custom":
            text = await transcribeCustom(blob, {
                apiUrl: opts.customApiUrl || "",
                apiKey: opts.customApiKey,
                model: opts.customModel,
                language,
            });
            break;
        case "local":
            text = await transcribeLocal(blob, { language });
            break;
        default:
            throw new Error(`Unknown STT backend: ${backend}`);
    }

    if (isHallucination(text)) {
        return "";
    }

    return text;
}
