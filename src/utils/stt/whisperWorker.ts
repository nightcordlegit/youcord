/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function createWorkerCode(): string {
    return `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = false;

let transcriber = null;

const pendingFetches = new Map();

self.addEventListener('message', async (event) => {
    const { type, id, audio, model, quantized, language } = event.data;

    if (type === 'fetch_response') {
        const resolver = pendingFetches.get(id);
        if (!resolver) return;
        pendingFetches.delete(id);
        if (event.data.error) {
            resolver.reject(new Error(event.data.error));
        } else {
            resolver.resolve(new Response(event.data.response, {
                headers: event.data.headers || { 'Content-Type': 'application/octet-stream' }
            }));
        }
        return;
    }

    if (type === 'load') {
        try {
            self.postMessage({ type: 'status', status: 'downloading' });
            transcriber = await pipeline('automatic-speech-recognition', model, {
                quantized: quantized,
                progress_callback: (data) => {
                    self.postMessage({ type: 'progress', data });
                }
            });
            self.postMessage({ type: 'status', status: 'ready' });
        } catch (e) {
            self.postMessage({ type: 'error', error: e.toString() });
        }
        return;
    }

    if (type === 'transcribe') {
        if (!transcriber) {
            self.postMessage({ type: 'error', error: 'Model not loaded' });
            return;
        }
        try {
            self.postMessage({ type: 'status', status: 'transcribing' });
            const output = await transcriber(audio, {
                top_k: 0,
                do_sample: false,
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: false,
                language: language || undefined,
            });
            self.postMessage({ type: 'result', text: output.text.trim() });
        } catch (e) {
            self.postMessage({ type: 'error', error: e.toString() });
        }
        return;
    }
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const url = input.toString();
    if (url.includes('huggingface.co') || url.includes('cdn.jsdelivr.net')) {
        const id = Math.random().toString(36).substring(7);
        return new Promise((resolve, reject) => {
            pendingFetches.set(id, { resolve, reject });
            self.postMessage({ type: 'fetch_request', url, id });
        });
    }
    return originalFetch(input, init);
};
`;
}
