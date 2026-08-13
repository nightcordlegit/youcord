/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { waitFor } from "@webpack";
import { React, useEffect, useState } from "@webpack/common";

// Version locale (injectee au build via define)
declare const VERSION: string;
declare const BUILD_TIMESTAMP: number;

function getLocalVersion(): string {
    try { return VERSION; } catch { return "0.0.0"; }
}

function getBuildTimestamp(): number {
    try { return BUILD_TIMESTAMP; } catch { return 0; }
}

interface UpdateInfo {
    remoteVersion: string;
    localVersion: string;
}

let pendingUpdate: UpdateInfo | null = null;
let listeners: Array<() => void> = [];
let initialCheckTimer: ReturnType<typeof setTimeout> | null = null;
let periodicCheckTimer: ReturnType<typeof setInterval> | null = null;
let checkPromise: Promise<void> | null = null;

function notify() { listeners.forEach(f => f()); }

async function runUpdateCheck() {
    try {
        const localVersion = getLocalVersion();
        const myBuildTime = getBuildTimestamp();
        let found = false;

        // 1) Check local build (build.json on disk)
        try {
            const { VencordNative } = (window as any);
            const ipc = VencordNative?.updater;
            if (ipc?.getLocalBuild) {
                const res: any = await ipc.getLocalBuild();
                const localBuild = res?.ok ? res.value : res;
                if (localBuild?.buildTime && localBuild.buildTime > myBuildTime) {
                    const diskVersion = localBuild.version ?? localVersion;
                    console.log(`[YouCordUpdater] Local build detected: disk(${diskVersion} @ ${localBuild.buildTime}) > running(${localVersion} @ ${myBuildTime})`);
                    pendingUpdate = { remoteVersion: `${diskVersion} (local)`, localVersion };
                    found = true;
                }
            }
        } catch { /* IPC non disponible (web) */ }

        // 2) Ask the native updater. It validates the release manifest and uses
        // the exact same release data that will later be downloaded.
        if (!found) {
            const { VencordNative } = (window as any);
            const result = await VencordNative?.updater?.getUpdates?.();
            if (!result?.ok) throw new Error(result?.error?.message ?? "Update check failed");
            const updates = result.value as Array<{ hash: string; message: string; }>;
            if (updates?.length) {
                pendingUpdate = { remoteVersion: updates[0].hash.slice(0, 8), localVersion };
                found = true;
            }
        }

        if (!found) pendingUpdate = null;

        notify();
    } catch (e: any) {
        console.error("[YouCordUpdater] Error:", e);
    }
}

function checkForUpdates() {
    if (!checkPromise) checkPromise = runUpdateCheck().finally(() => { checkPromise = null; });
    return checkPromise;
}

function UpdateBanner() {
    const [info, setInfo] = useState<UpdateInfo | null>(pendingUpdate);
    const [dismissed, setDismissed] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fn = () => setInfo(pendingUpdate);
        listeners.push(fn);
        return () => { listeners = listeners.filter(f => f !== fn); };
    }, []);

    if (!info || dismissed) return null;

    const isLocalUpdate = info.remoteVersion.includes("(local)");

    async function doUpdate() {
        if (loading || !info) return;
        setLoading(true);

        try {
            const { VencordNative } = (window as any);

            if (isLocalUpdate) {
                setStatus("Restarting to apply local build...");
                setTimeout(() => {
                    try {
                        VencordNative.youcord?.relaunch?.();
                    } catch {
                        (window as any).DiscordNative?.app?.relaunch?.();
                        window.location.reload();
                    }
                }, 1000);
                return;
            }

            setStatus("Downloading...");

            const ipc = VencordNative?.updater;
            if (!ipc) throw new Error("VencordNative.updater not available");

            const updateRes: { ok: boolean; value?: boolean; error?: any; } = await ipc.update();
            if (!updateRes?.ok) {
                throw new Error(updateRes?.error?.message ?? "Update check failed");
            }

            setStatus("Downloaded! Extracting...");
            const buildRes: { ok: boolean; value?: boolean; error?: any; } = await ipc.rebuild();
            if (!buildRes?.ok) {
                const errMsg = buildRes?.error?.message ?? JSON.stringify(buildRes?.error) ?? "Installation failed";
                throw new Error(errMsg);
            }

            setStatus("Update applied - restarting in 2s...");

            setTimeout(() => {
                try {
                    VencordNative.youcord?.relaunch?.();
                } catch {
                    (window as any).DiscordNative?.app?.relaunch?.();
                    window.location.reload();
                }
            }, 2000);
        } catch (e: any) {
            console.error("[YouCordUpdater] Update error:", e);
            const msg = e?.message ? e.message.substring(0, 120) : "Unknown error";
            setStatus(`${msg}. Check your connection or restart manually.`);
            setLoading(false);
        }
    }

    return React.createElement("div", {
        style: {
            position: "fixed",
            top: 0, left: 0, right: 0,
            zIndex: 999999,
            background: "linear-gradient(90deg, #1e5c2a 0%, #3ba55c 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 16px",
            fontSize: 13,
            fontFamily: "var(--font-primary, sans-serif)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.5)",
            gap: 12,
        }
    },
        React.createElement("div", {
            style: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }
        },
            React.createElement("span", { style: { fontWeight: 700, flexShrink: 0 } },
                `YouCord ${info.remoteVersion} available!${isLocalUpdate ? " (restart required)" : ""}`
            ),
            React.createElement("span", {
                style: { opacity: 0.85, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            },
                status ?? `Current version: ${info.localVersion}`
            )
        ),
        React.createElement("div", { style: { display: "flex", gap: 8, flexShrink: 0 } },
            React.createElement("button", {
                onClick: doUpdate,
                disabled: loading,
                style: {
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 6,
                    color: "#fff",
                    padding: "4px 14px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                }
            }, loading ? "..." : isLocalUpdate ? "Restart" : "Update"),
            React.createElement("button", {
                onClick: () => setDismissed(true),
                style: {
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    fontSize: 18,
                    padding: "0 4px",
                    fontFamily: "inherit",
                    lineHeight: 1,
                },
                title: "Dismiss"
            }, "x")
        )
    );
}

let bannerRoot: any = null;
let bannerContainer: HTMLDivElement | null = null;

function mountBanner() {
    if (bannerContainer || document.getElementById("youcord-updater-root")) return;

    waitFor(["createRoot", "render"], (ReactDOM: any) => {
        if (bannerContainer || document.getElementById("youcord-updater-root")) return;
        bannerContainer = document.createElement("div");
        bannerContainer.id = "youcord-updater-root";
        document.body.appendChild(bannerContainer);
        try {
    if (ReactDOM?.createRoot) {
            bannerRoot = ReactDOM.createRoot(bannerContainer);
            bannerRoot.render(React.createElement(UpdateBanner));
        } else {
            console.warn("[YouCordUpdater] ReactDOM.createRoot not available");
        }
        } catch (e) {
            console.error("[YouCordUpdater] Error mounting banner:", e);
            bannerContainer?.remove();
            bannerContainer = null;
        }
    });
}

function unmountBanner() {
    try { bannerRoot?.unmount(); } catch { }
    bannerContainer?.remove();
    bannerContainer = null;
    bannerRoot = null;
}

export default definePlugin({
    name: "YouCordUpdater",
    enabledByDefault: true,
    description: "Shows a banner when a new YouCord version is available. Click Update to install.",
    authors: [{ name: "YouCord", id: 0n }],

    start() {
        const mountWhenReady = () => setTimeout(mountBanner, 1500);
        if (document.readyState === "complete") mountWhenReady();
        else window.addEventListener("load", mountWhenReady, { once: true });

        initialCheckTimer = setTimeout(() => void checkForUpdates(), 15_000);
        periodicCheckTimer = setInterval(() => void checkForUpdates(), 30 * 60_000);
        window.addEventListener("online", checkForUpdates);
    },

    stop() {
        if (initialCheckTimer) clearTimeout(initialCheckTimer);
        if (periodicCheckTimer) clearInterval(periodicCheckTimer);
        initialCheckTimer = periodicCheckTimer = null;
        window.removeEventListener("online", checkForUpdates);
        unmountBanner();
        pendingUpdate = null;
        listeners = [];
    },
});
