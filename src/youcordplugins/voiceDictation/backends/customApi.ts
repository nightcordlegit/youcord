/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

const logger = new Logger("CustomSTT");

interface CustomApiBackendOpts {
    apiUrl: string;
    apiKey?: string;
    model?: string;
    language?: string;
}

export async function transcribeCustom(blob: Blob, opts: CustomApiBackendOpts): Promise<string> {
    const { apiUrl, apiKey, model, language } = opts;

    if (!apiUrl || !apiUrl.trim()) {
        throw new Error("Custom API URL not configured — set it in VoiceDictation settings");
    }

    const url = apiUrl.replace(/\/+$/, "");

    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("model", model || "whisper-1");
    form.append("response_format", "text");
    if (language) form.append("language", language);

    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    logger.debug("Sending to custom STT API:", url);

    const res = await fetch(url, {
        method: "POST",
        headers,
        body: form,
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Custom STT API ${res.status}: ${body.slice(0, 200)}`);
    }

    return (await res.text()).trim();
}
