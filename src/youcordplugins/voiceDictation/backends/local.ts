/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { decodeAudio } from "../../../utils/stt/audioUtils";
import { TranscriberCallbacks, WhisperModel, WhisperTranscriber } from "../../../utils/stt/WhisperTranscriber";

const logger = new Logger("LocalSTT");

let transcriber: WhisperTranscriber | null = null;
let _callbacks: TranscriberCallbacks = {};

interface LocalBackendOpts {
    language?: string;
    model?: WhisperModel;
    quantized?: boolean;
}

export function initLocalTranscriber(opts: LocalBackendOpts, callbacks?: TranscriberCallbacks) {
    if (transcriber) {
        logger.warn("Transcriber already initialized, re-creating");
        destroyLocalTranscriber();
    }

    if (callbacks) _callbacks = callbacks;

    transcriber = new WhisperTranscriber(opts.model || "Xenova/whisper-base", opts.quantized !== false);
    transcriber.setCallbacks({
        ..._callbacks,
        onStatus: status => {
            logger.debug("Transcriber status:", status);
            _callbacks.onStatus?.(status);
        },
        onError: err => {
            logger.error("Transcriber error:", err);
            _callbacks.onError?.(err);
        },
    });

    transcriber.load();
}

export function destroyLocalTranscriber() {
    if (transcriber) {
        transcriber.terminate();
        transcriber = null;
    }
}

export function getLocalTranscriberStatus() {
    return transcriber?.status ?? "idle";
}

export function isLocalTranscriberReady(): boolean {
    return transcriber?.ready ?? false;
}

export async function transcribeLocal(blob: Blob, opts: LocalBackendOpts): Promise<string> {
    if (!transcriber) {
        throw new Error("Local transcriber not initialized — call initLocalTranscriber() first");
    }
    if (!transcriber.ready) {
        throw new Error("Local transcriber not ready — model is still loading");
    }

    try {
        const audio = await decodeAudio(blob);
        return await transcriber.transcribe(audio, opts.language);
    } catch (e: any) {
        logger.error("Local transcription failed:", e);
        throw e;
    }
}
