/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

declare const BUILD_TIMESTAMP: number;

let startupTimer: ReturnType<typeof setTimeout> | null = null;
let updatePromise: Promise<void> | null = null;

function getBuildTimestamp(): number {
    try { return BUILD_TIMESTAMP; } catch { return 0; }
}

function relaunch() {
    const { VencordNative } = window as any;
    try {
        VencordNative.youcord?.relaunch?.();
    } catch {
        (window as any).DiscordNative?.app?.relaunch?.();
        window.location.reload();
    }
}

async function installUpdateAtStartup() {
    try {
        const { VencordNative } = window as any;
        const ipc = VencordNative?.updater;
        if (!ipc) return;

        // A newer build may already be installed on disk while this renderer is
        // still running the previous one. In that case only a relaunch is needed.
        const localResult = await ipc.getLocalBuild?.();
        const localBuild = localResult?.ok ? localResult.value : localResult;
        if (localBuild?.buildTime > getBuildTimestamp()) {
            console.log("[YouCordUpdater] New local build found; restarting silently.");
            relaunch();
            return;
        }

        // GET_UPDATES validates the public manifest and prepares the exact asset
        // to install. No banner is shown: startup remains the update boundary.
        const updateResult = await ipc.getUpdates?.();
        if (!updateResult?.ok) throw new Error(updateResult?.error?.message ?? "Update check failed");
        if (!updateResult.value?.length) return;

        console.log("[YouCordUpdater] Installing verified update silently.");
        const installResult = await ipc.rebuild();
        if (!installResult?.ok || installResult.value !== true)
            throw new Error(installResult?.error?.message ?? "Update installation failed");

        relaunch();
    } catch (error) {
        // Updating must never block Discord startup. Retry on the next restart.
        console.error("[YouCordUpdater] Silent startup update failed:", error);
    }
}

function runStartupUpdate() {
    if (!updatePromise) updatePromise = installUpdateAtStartup().finally(() => { updatePromise = null; });
    return updatePromise;
}

export default definePlugin({
    name: "YouCordUpdater",
    enabledByDefault: true,
    description: "Silently installs verified YouCord updates when the client starts.",
    authors: [{ name: "YouCord", id: 0n }],

    start() {
        startupTimer = setTimeout(() => void runStartupUpdate(), 5_000);
    },

    stop() {
        if (startupTimer) clearTimeout(startupTimer);
        startupTimer = null;
    },
});
