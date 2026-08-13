/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import { dirname, join, normalize } from "node:path";

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { app, ipcMain } from "electron";
import { unzipSync } from "fflate";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "original-fs";

import { serializeErrors } from "./common";

const RELEASE_API = "https://api.github.com/repos/nightcordlegit/youcord/releases/tags/latest";
const ZIP_FILE = "youcord-dist.zip";
const MANIFEST_FILE = "update-manifest.json";

interface BuildInfo {
    buildTime: number;
    gitHash?: string;
    version?: string;
}

interface UpdateManifest extends BuildInfo {
    asset: typeof ZIP_FILE;
    sha256: string;
}

interface PendingUpdate {
    downloadUrl: string;
    manifest: UpdateManifest;
}

let pendingUpdate: PendingUpdate | null = null;
let isApplying = false;

const headers = { Accept: "application/vnd.github.v3+json", "User-Agent": VENCORD_USER_AGENT };

function getLocalBuild(): BuildInfo | null {
    try {
        return JSON.parse(readFileSync(join(__dirname, "build.json"), "utf8"));
    } catch {
        return null;
    }
}

async function fetchWithTimeout<T>(request: (signal: AbortSignal) => Promise<T>, timeoutMs = 20_000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await request(controller.signal);
    } finally {
        clearTimeout(timer);
    }
}

async function discoverUpdate(): Promise<PendingUpdate | null> {
    const release = await fetchWithTimeout(signal => fetchJson<any>(RELEASE_API, { headers, signal }));
    const assets: any[] = release?.assets ?? [];
    const zipAsset = assets.find(asset => asset.name === ZIP_FILE);
    const manifestAsset = assets.find(asset => asset.name === MANIFEST_FILE);
    if (!zipAsset?.browser_download_url || !manifestAsset?.browser_download_url) return null;

    const manifest = await fetchWithTimeout(signal => fetchJson<UpdateManifest>(manifestAsset.browser_download_url, {
        headers: { ...headers, Accept: "application/octet-stream" }, signal
    }));
    if (manifest.asset !== ZIP_FILE || !Number.isFinite(manifest.buildTime) || !/^[a-f\d]{64}$/i.test(manifest.sha256))
        throw new Error("Invalid update manifest");

    const local = getLocalBuild();
    if (local?.gitHash && manifest.gitHash === local.gitHash) return null;
    if (local?.buildTime && manifest.buildTime <= local.buildTime) return null;

    return { downloadUrl: zipAsset.browser_download_url, manifest };
}

async function fetchUpdates(): Promise<boolean> {
    pendingUpdate = await discoverUpdate();
    return pendingUpdate !== null;
}

async function getUpdates() {
    if (!await fetchUpdates()) return [];
    const { manifest } = (pendingUpdate!);
    return [{
        hash: manifest.gitHash ?? String(manifest.buildTime),
        author: "YouCord",
        message: `Nouvelle version disponible : ${manifest.version ?? "latest"}`
    }];
}

function safeArchivePath(name: string): string | null {
    const normalized = normalize(name.replaceAll("\\", "/"));
    if (!normalized || normalized === "." || normalized.startsWith("..") || normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) return null;
    return normalized;
}

async function applyUpdates(): Promise<boolean> {
    if (isApplying) return false;
    if (!pendingUpdate) pendingUpdate = await discoverUpdate();
    if (!pendingUpdate) return false;
    isApplying = true;

    const staging = join(app.getPath("temp"), `youcord-update-${Date.now()}`);
    const backup = `${staging}-backup`;
    const destination = __dirname;

    try {
        const archive = await fetchWithTimeout(signal => fetchBuffer(pendingUpdate!.downloadUrl, { signal }), 120_000);
        const actualHash = createHash("sha256").update(archive).digest("hex");
        if (actualHash !== pendingUpdate.manifest.sha256.toLowerCase()) throw new Error("Update checksum mismatch");

        const files = unzipSync(new Uint8Array(archive));
        const entries = Object.entries(files).filter(([, data]) => data.length > 0);
        if (!entries.some(([name]) => safeArchivePath(name) === "patcher.js")) throw new Error("Invalid update archive: patcher.js missing");

        mkdirSync(staging, { recursive: true });
        mkdirSync(backup, { recursive: true });
        for (const [name, data] of entries) {
            const relative = safeArchivePath(name);
            if (!relative) throw new Error(`Unsafe update path: ${name}`);
            const target = join(staging, relative);
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, data, { flush: true });
        }

        // Keep a rollback copy. If replacement fails, restore the previous build.
        cpSync(destination, backup, { recursive: true, force: true, filter: source => !source.startsWith(staging) && !source.startsWith(backup) });
        try {
            cpSync(staging, destination, { recursive: true, force: true });
        } catch (error) {
            cpSync(backup, destination, { recursive: true, force: true });
            throw error;
        }

        pendingUpdate = null;
        return true;
    } finally {
        isApplying = false;
        if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
        if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
    }
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => "https://github.com/nightcordlegit/youcord"));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(getUpdates));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));
ipcMain.handle(IpcEvents.GET_LOCAL_BUILD, serializeErrors(getLocalBuild));
