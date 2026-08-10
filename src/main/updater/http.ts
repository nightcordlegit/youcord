/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { exec } from "child_process";
import { app,ipcMain } from "electron";
import { readFileSync, rmSync,writeFileSync } from "original-fs";
import { join } from "path";

import { serializeErrors } from "./common";

const GITHUB_API = "https://api.github.com/repos/nightcordlegit/youcord";
declare const VERSION: string;
const CURRENT_VERSION = `v${VERSION}`;
const ZIP_FILE = "youcord-dist.zip";

let pendingDownloadUrl: string | null = null;
let pendingVersion: string | null = null;
let isApplying = false;

async function githubGet<T = any>(endpoint: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
        return await fetchJson<T>(GITHUB_API + endpoint, {
            headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": VENCORD_USER_AGENT
            },
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchUpdates(): Promise<boolean> {
    const [latestData, currentData] = await Promise.all([
        githubGet<any>("/releases/latest"),
        githubGet<any>(`/releases/tags/v${VERSION}`).catch(() => null)
    ]);

    // Si la version locale n'existe pas sur GitHub, c'est un build custom → ne pas update
    if (!currentData?.published_at) return false;

    const latestTag: string = latestData.tag_name ?? "";
    const latestDate = new Date(latestData.published_at).getTime();
    const currentDate = new Date(currentData.published_at).getTime();

    if (!latestTag || latestDate <= currentDate) return false;

    const asset = (latestData.assets as any[])?.find(
        (a: any) => a.name === ZIP_FILE
    );
    if (!asset) return false;

    pendingDownloadUrl = asset.browser_download_url;
    pendingVersion = latestTag;
    return true;
}

async function getUpdates() {
    const outdated = await fetchUpdates();
    if (!outdated) return [];
    return [{
        hash:    pendingVersion ?? "new",
        author:  "YouCord",
        message: `Nouvelle version disponible : ${pendingVersion}`
    }];
}

async function applyUpdates(): Promise<boolean> {
    if (!pendingDownloadUrl) return false;
    if (isApplying) return false;
    isApplying = true;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120_000);
        let data: Buffer;
        try {
            data = await fetchBuffer(pendingDownloadUrl, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }

        // Save zip to temp
        const zipPath = join(app.getPath("temp"), `youcord-update-${Date.now()}.zip`);
        writeFileSync(zipPath, data, { flush: true });

        // The zip was created from dist/desktop/ with includeBaseDirectory=false,
        // so its contents are exactly what belongs in dist/desktop/ = __dirname.
        // Using __dirname directly avoids the off-by-one-level bug.
        const destPath = __dirname;

        // Extract using PowerShell Expand-Archive (reliable ZIP support on all Windows 10/11)
        // We extract to a temp folder first, then move files over to avoid half-extracted state
        const tmpExtract = join(app.getPath("temp"), `youcord-extract-${Date.now()}`);

        return await new Promise<boolean>((resolve, reject) => {
            // Step 1 — extract zip to temp folder
            const psExtract = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${tmpExtract}' -Force`;
            exec(`powershell -NoProfile -NonInteractive -Command "${psExtract}"`, err => {
                if (err) {
                    try { rmSync(zipPath, { force: true }); } catch {}
                    return reject(new Error("ZIP extraction failed: " + err.message));
                }

                // Step 2 — copy extracted files into dist/desktop/ (= __dirname), overwriting existing ones
                const psMove = `Copy-Item -Path '${tmpExtract}\\*' -Destination '${destPath}' -Recurse -Force`;
                exec(`powershell -NoProfile -NonInteractive -Command "${psMove}"`, err2 => {
                    // Cleanup temp files regardless of outcome
                    try { rmSync(zipPath, { force: true }); } catch {}
                    try { rmSync(tmpExtract, { recursive: true, force: true }); } catch {}

                    if (err2) {
                        return reject(new Error("File copy failed: " + err2.message));
                    }

                    pendingDownloadUrl = null;
                    pendingVersion = null;
                    resolve(true);
                });
            });
        });
    } finally {
        isApplying = false;
    }
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => "https://github.com/nightcordlegit/youcord"));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(getUpdates));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));
ipcMain.handle(IpcEvents.GET_LOCAL_BUILD, serializeErrors(async () => {
    try {
        const data = readFileSync(join(__dirname, "build.json"), "utf-8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}));
