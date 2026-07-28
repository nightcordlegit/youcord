/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, ipcMain, net } from "electron";
import { autoUpdater, UpdateInfo } from "electron-updater";
import { join } from "path";
import { IpcEvents, UpdaterIpcEvents } from "shared/IpcEvents";
import { STATIC_DIR } from "shared/paths";
import { Millis } from "shared/utils/millis";

import { State } from "./settings";
import { handle } from "./utils/ipcWrappers";
import { makeLinksOpenExternally } from "./utils/makeLinksOpenExternally";
import { loadView } from "./vesktopStatic";

// YouCord native defaults â€” no external prefs file, always on
const YOUCORD_PREFS = { defaultPlugins: true, autoUpdate: true } as const;

export const installerPrefs = YOUCORD_PREFS;

handle(IpcEvents.GET_INSTALLER_PREFS, () => YOUCORD_PREFS);

let updaterWindow: BrowserWindow | null = null;

async function isNewerByDate(remoteVersion: string): Promise<boolean> {
    try {
        const localVersion = app.getVersion();
        const [remoteRes, localRes] = await Promise.all([
            net.fetch(`https://api.github.com/repos/nightcordlegit/youcord/releases/tags/v${remoteVersion}`),
            net.fetch(`https://api.github.com/repos/nightcordlegit/youcord/releases/tags/v${localVersion}`)
        ]);
        const [remoteData, localData] = await Promise.all([
            remoteRes.ok ? remoteRes.json() : null,
            localRes.ok ? localRes.json() : null
        ]);

        // Si la version locale n'a pas de release GitHub (build custom), ne pas update
        if (!localData?.published_at) return false;
        if (!remoteData?.published_at) return false;

        return new Date(remoteData.published_at).getTime() > new Date(localData.published_at).getTime();
    } catch {
        return false;
    }
}

autoUpdater.on("update-available", async update => {
    if (State.store.updater?.ignoredVersion === update.version) return;
    if ((State.store.updater?.snoozeUntil ?? 0) > Date.now()) return;
    if (update.version === app.getVersion()) return;
    if (updaterWindow && !updaterWindow.isDestroyed()) return;

    // Date-based check pour éviter les régressions de version
    if (!await isNewerByDate(update.version)) return;

    openUpdater(update);
});

autoUpdater.on("update-downloaded", () => {
    updaterWindow?.webContents.send(UpdaterIpcEvents.DOWNLOAD_PROGRESS, 100);
});

autoUpdater.on("download-progress", p =>
    updaterWindow?.webContents.send(UpdaterIpcEvents.DOWNLOAD_PROGRESS, p.percent)
);
autoUpdater.on("error", err => updaterWindow?.webContents.send(UpdaterIpcEvents.ERROR, err.message));

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.fullChangelog = true;

const isOutdated: Promise<boolean> = new Promise(resolve => {
    app.whenReady().then(() => {
        setTimeout(async () => {
            try {
                const res = await autoUpdater.checkForUpdates();
                if (!res?.isUpdateAvailable) return resolve(false);
                if (res.updateInfo?.version === app.getVersion()) return resolve(false);

                // Date-based check
                const newer = await isNewerByDate(res.updateInfo.version);
                resolve(newer);
            } catch {
                resolve(false);
            }
        }, 5000);
    });
});

handle(IpcEvents.UPDATER_IS_OUTDATED, () => isOutdated);
handle(IpcEvents.UPDATER_OPEN, async () => {
    const res = await autoUpdater.checkForUpdates();
    if (res?.isUpdateAvailable && res.updateInfo) {
        // Date-based check
        if (await isNewerByDate(res.updateInfo.version)) {
            openUpdater(res.updateInfo);
        }
    }
});

function openUpdater(update: UpdateInfo) {
    if (updaterWindow && !updaterWindow.isDestroyed()) {
        updaterWindow.focus();
        return;
    }

    ipcMain.removeHandler(UpdaterIpcEvents.GET_DATA);
    ipcMain.removeHandler(UpdaterIpcEvents.INSTALL);
    ipcMain.removeHandler(UpdaterIpcEvents.SNOOZE_UPDATE);
    ipcMain.removeHandler(UpdaterIpcEvents.IGNORE_UPDATE);

    updaterWindow = new BrowserWindow({
        title: "YouCord Updater",
        autoHideMenuBar: true,
        ...(process.platform === "win32"
            ? { icon: join(STATIC_DIR, "icon.ico") }
            : process.platform === "linux"
              ? { icon: join(STATIC_DIR, "icon.png") }
              : {}),
        webPreferences: {
            preload: join(__dirname, "updaterPreload.js")
        },
        minHeight: 400,
        minWidth: 750
    });
    makeLinksOpenExternally(updaterWindow);

    handle(UpdaterIpcEvents.GET_DATA, () => ({
        update,
        version: app.getVersion(),
        autoUpdate: true
    }));
    handle(UpdaterIpcEvents.INSTALL, async () => {
        await autoUpdater.downloadUpdate();
        autoUpdater.quitAndInstall(false, true);
    });
    handle(UpdaterIpcEvents.SNOOZE_UPDATE, () => {
        State.store.updater ??= {};
        State.store.updater.snoozeUntil = Date.now() + 1 * Millis.DAY;
        updaterWindow?.close();
    });
    handle(UpdaterIpcEvents.IGNORE_UPDATE, () => {
        State.store.updater ??= {};
        State.store.updater.ignoredVersion = update.version;
        updaterWindow?.close();
    });

    updaterWindow.on("closed", () => {
        ipcMain.removeHandler(UpdaterIpcEvents.GET_DATA);
        ipcMain.removeHandler(UpdaterIpcEvents.INSTALL);
        ipcMain.removeHandler(UpdaterIpcEvents.SNOOZE_UPDATE);
        ipcMain.removeHandler(UpdaterIpcEvents.IGNORE_UPDATE);
        updaterWindow = null;
    });

    loadView(updaterWindow, "updater/index.html");
}
