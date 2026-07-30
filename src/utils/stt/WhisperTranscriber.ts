/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { lodash } from "@webpack/common";

import { createWorkerCode } from "./whisperWorker";

const logger = new Logger("WhisperTranscriber");
const CACHE_PREFIX = "VoiceDictation_model_";

export type WhisperModel = "Xenova/whisper-tiny" | "Xenova/whisper-base" | "Xenova/whisper-small";

export type TranscriberStatus = "idle" | "downloading" | "loading" | "ready" | "transcribing" | "error";

export interface TranscriberCallbacks {
    onStatus?: (status: TranscriberStatus) => void;
    onProgress?: (progress: number) => void;
    onError?: (error: string) => void;
}

export class WhisperTranscriber {
    private worker: Worker | null = null;
    private _status: TranscriberStatus = "idle";
    private _model: WhisperModel;
    private _quantized: boolean;
    private _callbacks: TranscriberCallbacks = {};
    private _requestId = 0;
    private _pendingTranscribe: { resolve: (text: string) => void; reject: (err: Error) => void } | null = null;

    get status(): TranscriberStatus { return this._status; }
    get ready(): boolean { return this._status === "ready"; }
    get loading(): boolean { return this._status === "downloading" || this._status === "loading"; }

    constructor(model: WhisperModel = "Xenova/whisper-base", quantized = true) {
        this._model = model;
        this._quantized = quantized;
    }

    setCallbacks(cbs: TranscriberCallbacks) {
        this._callbacks = cbs;
    }

    private setStatus(status: TranscriberStatus) {
        this._status = status;
        this._callbacks.onStatus?.(status);
    }

    load(): void {
        if (this.worker) {
            logger.warn("Worker already exists, terminating previous one");
            this.terminate();
        }

        const code = createWorkerCode();
        const blob = new Blob([code], { type: "text/javascript" });
        this.worker = new Worker(URL.createObjectURL(blob), { type: "module" });

        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = e => {
            logger.error("Worker error:", e.message);
            this.setStatus("error");
            this._callbacks.onError?.(e.message);
        };

        this.setStatus("downloading");
        this.worker.postMessage({
            type: "load",
            model: this._model,
            quantized: this._quantized,
        });
    }

    transcribe(audio: Float32Array, language?: string): Promise<string> {
        if (!this.worker || !this.ready) {
            return Promise.reject(new Error("Transcriber not ready — model is still loading"));
        }

        return new Promise((resolve, reject) => {
            this._pendingTranscribe = { resolve, reject };
            this.worker!.postMessage({
                type: "transcribe",
                audio,
                language,
            });
        });
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this._status = "idle";
        this._pendingTranscribe = null;
    }

    private getMimeType(url: string): string {
        if (url.endsWith(".wasm")) return "application/wasm";
        if (url.endsWith(".json")) return "application/json";
        if (url.endsWith(".onnx")) return "application/octet-stream";
        return "application/octet-stream";
    }

    private async handleMessage(event: MessageEvent) {
        const { type, id, url, status, data, text, error } = event.data;

        switch (type) {
            case "fetch_request":
                try {
                    const cached = await DataStore.get(`${CACHE_PREFIX}${url}`);
                    if (cached && lodash.isArrayBuffer(cached)) {
                        this.worker?.postMessage({
                            type: "fetch_response",
                            id,
                            response: cached,
                            headers: {
                                "Content-Length": cached.byteLength.toString(),
                                "Content-Type": this.getMimeType(url),
                            },
                        });
                    } else {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
                        const buffer = await res.arrayBuffer();
                        await DataStore.set(`${CACHE_PREFIX}${url}`, buffer);
                        this.worker?.postMessage({
                            type: "fetch_response",
                            id,
                            response: buffer,
                            headers: {
                                "Content-Length": res.headers.get("Content-Length") || buffer.byteLength.toString(),
                                "Content-Type": this.getMimeType(url),
                            },
                        });
                    }
                } catch (err) {
                    logger.error("Fetch failed for", url, err);
                    this.worker?.postMessage({
                        type: "fetch_response",
                        id,
                        error: String(err),
                    });
                }
                break;

            case "status":
                if (status === "downloading" || status === "loading") {
                    this.setStatus(status as TranscriberStatus);
                } else if (status === "ready") {
                    this.setStatus("ready");
                } else if (status === "transcribing") {
                    this.setStatus("transcribing");
                }
                break;

            case "progress":
                if (data && typeof data.progress === "number") {
                    this._callbacks.onProgress?.(data.progress);
                }
                break;

            case "result":
                this.setStatus("ready");
                if (this._pendingTranscribe) {
                    this._pendingTranscribe.resolve(text);
                    this._pendingTranscribe = null;
                }
                break;

            case "error":
                this.setStatus("error");
                this._callbacks.onError?.(error);
                if (this._pendingTranscribe) {
                    this._pendingTranscribe.reject(new Error(error));
                    this._pendingTranscribe = null;
                }
                break;
        }
    }
}
