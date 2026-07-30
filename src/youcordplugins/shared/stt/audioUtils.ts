/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export async function decodeAudio(blob: Blob, targetSampleRate = 16000): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: targetSampleRate });
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        let channelData = audioBuffer.getChannelData(0);

        if (audioBuffer.numberOfChannels > 1) {
            for (let i = 1; i < audioBuffer.numberOfChannels; i++) {
                const channel = audioBuffer.getChannelData(i);
                for (let j = 0; j < channelData.length; j++) {
                    channelData[j] += channel[j];
                }
            }
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] /= audioBuffer.numberOfChannels;
            }
        }

        if (audioBuffer.sampleRate !== targetSampleRate) {
            const ratio = targetSampleRate / audioBuffer.sampleRate;
            const newLength = Math.round(channelData.length * ratio);
            const resampled = new Float32Array(newLength);
            for (let i = 0; i < newLength; i++) {
                const srcIdx = Math.min(Math.floor(i / ratio), channelData.length - 1);
                resampled[i] = channelData[srcIdx];
            }
            channelData = resampled;
        }

        return channelData;
    } finally {
        await audioContext.close();
    }
}
