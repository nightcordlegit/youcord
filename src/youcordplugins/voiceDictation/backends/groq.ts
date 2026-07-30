/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getGroqKey } from "../../youcordAI/groqManager";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

interface GroqBackendOpts {
    language?: string;
}

export async function transcribeGroq(blob: Blob, opts: GroqBackendOpts): Promise<string> {
    const language = opts.language?.trim() || undefined;
    const apiKey = await getGroqKey();
    if (!apiKey) {
        throw new Error("API key missing — Configure your key in Settings → YouCordAI");
    }

    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "text");
    form.append("prompt", "Ceci est une dictée vocale en français. Ne pas traduire en anglais. Ne pas générer de texte si il n'y a que du silence.");
    if (language) form.append("language", language);

    const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Groq API ${res.status}: ${body.slice(0, 120)}`);
    }

    return (await res.text()).trim();
}
