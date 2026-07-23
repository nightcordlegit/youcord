/*!
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// DO NOT REMOVE UNLESS YOU WISH TO FACE THE WRATH OF THE CIRCULAR DEPENDENCY DEMON!!!!!!!
import "~plugins";
console.log("%c[YouCord]", "color: #5865f2; font-weight: bold;", "Injection successful! Starting services...");

export * as Api from "./api";
export * as Plugins from "./api/PluginManager";
export * as Components from "./components";
export * as Util from "./utils";
export * as Updater from "./utils/updater";
export * as Webpack from "./webpack";
export * as WebpackPatcher from "./webpack/patchWebpack";
export { PlainSettings, Settings };

import { coreStyleRootNode, initStyles } from "@api/Styles";
import { openSettingsTabModal, UpdaterTab } from "@components/settings";
import { debounce } from "@shared/debounce";
import { IS_WINDOWS } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { StartAt } from "@utils/types";
import { Alerts,SettingsRouter } from "@webpack/common";

import { get as dsGet } from "./api/DataStore";
import { t } from "./api/i18n";
import { popNotice, showNotice } from "./api/Notices";
import { showNotification } from "./api/Notifications";
import { initPluginManager, PMLogger, startAllPlugins } from "./api/PluginManager";
import { PlainSettings, Settings, SettingsStore } from "./api/Settings";
import { getCloudSettings, putCloudSettings, shouldCloudSync } from "./api/SettingsSync/cloudSync";
import { localStorage } from "./utils/localStorage";
import { relaunch } from "./utils/native";
import { checkForUpdates, isOutdated as getIsOutdated, rebuild, update, UpdateLogger } from "./utils/updater";
import { onceReady } from "./webpack";
import { patches } from "./webpack/patchWebpack";

if (IS_REPORTER) {
    require("./debug/runReporter");
}

function scheduleIdleCallback(fn: () => void, timeout = 2000) {
    if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(fn, { timeout });
    } else {
        setTimeout(fn, 1);
    }
}

async function syncSettings() {
    // Check if cloud auth exists for current user before attempting sync
    if (localStorage.Vencord_cloudSyncDirection === undefined) {
        // by default, sync bi-directionally
        localStorage.Vencord_cloudSyncDirection = "both";
    }
    const hasCloudAuth = await dsGet("Vencord_cloudSecret");
    if (!hasCloudAuth) {
        if (Settings.cloud.authenticated) {
            // User switched to an account that isn't connected to cloud
            showNotification({
                title: "Cloud Settings",
                body: "Cloud sync was disabled because this account isn't connected to the cloud App. You can enable it again by connecting this account in Cloud Settings. (note: it will store your preferences separately)",
                color: "var(--yellow-360)",
                onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
            });
            // Disable cloud sync globally
            Settings.cloud.authenticated = false;
        }
        return;
    }

    // pre-check for local shared settings
    if (
        Settings.cloud.authenticated &&
        !hasCloudAuth // this has been enabled due to local settings share or some other bug
    ) {
        // show a notification letting them know and tell them how to fix it
        showNotification({
            title: "Cloud Integrations",
            body: "We've noticed you have cloud integrations enabled in another client! Due to limitations, you will " +
                "need to re-authenticate to continue using them. Click here to go to the settings page to do so!",
            color: "var(--yellow-360)",
            onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
        });
        return;
    }

    if (
        Settings.cloud.settingsSync && // if it's enabled
        Settings.cloud.authenticated && // if cloud integrations are enabled
        localStorage.Vencord_cloudSyncDirection !== "manual" // if we're not in manual mode
    ) {
        if (localStorage.Vencord_settingsDirty && shouldCloudSync("push")) {
            await putCloudSettings();
        } else if (shouldCloudSync("pull") && await getCloudSettings(false)) { // if we synchronized something (false means no sync)
            // we show a notification here instead of allowing getCloudSettings() to show one to declutter the amount of
            // potential notifications that might occur. getCloudSettings() will always send a notification regardless if
            // there was an error to notify the user, but besides that we only want to show one notification instead of all
            // of the possible ones it has (such as when your settings are newer).
            showNotification({
                title: "Cloud Settings",
                body: "Your settings have been updated! Click here to restart to fully apply changes!",
                color: "var(--green-360)",
                onClick: relaunch
            });
        }
    }

    const saveSettingsOnFrequentAction = debounce(async () => {
        if (Settings.cloud.settingsSync && Settings.cloud.authenticated && shouldCloudSync("push")) {
            await putCloudSettings();
        }
    }, 60_000);

    SettingsStore.addGlobalChangeListener(() => {
        localStorage.Vencord_settingsDirty = true;
        saveSettingsOnFrequentAction();
    });
}

let notifiedForUpdatesThisSession = false;

function showGreenUpdateBanner() {
    if (document.getElementById("youcord-core-updater-root")) return;

    const banner = document.createElement("div");
    banner.id = "youcord-core-updater-root";
    Object.assign(banner.style, {
        position: "fixed",
        top: "0", left: "0", right: "0",
        zIndex: "999999",
        background: "rgba(30, 31, 34, 0.95)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        borderTop: "2px solid #5865F2",
        color: "#dbdee1",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        fontSize: "13px",
        fontFamily: "var(--font-primary, 'gg sans', sans-serif)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        gap: "12px",
    });

    const leftContent = document.createElement("div");
    Object.assign(leftContent.style, {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flex: "1",
        minWidth: "0",
    });

    const titleSpan = document.createElement("span");
    titleSpan.style.fontWeight = "600";
    titleSpan.style.color = "#ffffff";
    titleSpan.style.flexShrink = "0";
    titleSpan.textContent = "YouCord Update Available";

    const statusSpan = document.createElement("span");
    statusSpan.style.opacity = "0.7";
    statusSpan.style.fontSize = "12px";
    statusSpan.style.overflow = "hidden";
    statusSpan.style.textOverflow = "ellipsis";
    statusSpan.style.whiteSpace = "nowrap";

    let countdown = 10;
    let installing = false;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    function setStatus(text: string) { statusSpan.textContent = text; }
    setStatus(`Auto-installing in ${countdown}s... (or click to install now)`);

    async function doInstall() {
        if (installing) return;
        installing = true;
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        updateBtn.style.cursor = "not-allowed";
        updateBtn.style.opacity = "0.7";
        updateBtn.textContent = "Installing...";
        setStatus("Downloading update...");

        try {
            const downloaded = await update();
            if (!downloaded) throw new Error("Download failed");
            setStatus("Downloaded! Extracting...");
            await rebuild();
            setStatus("Update successful! Restarting in 3s...");
            setTimeout(() => relaunch(), 3_000);
        } catch (e) {
            UpdateLogger.error("Auto-install failed", e);
            setStatus("Install failed. Check console. Update will apply on restart.");
            installing = false;
            updateBtn.style.cursor = "pointer";
            updateBtn.style.opacity = "1";
            updateBtn.textContent = "Retry";
        }
    }

    // Auto-install after 10s
    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(countdownTimer!);
            countdownTimer = null;
            doInstall();
        } else {
            setStatus(`Auto-installing in ${countdown}s... (or click to install now)`);
        }
    }, 1_000);

    leftContent.appendChild(titleSpan);
    leftContent.appendChild(statusSpan);

    const rightContent = document.createElement("div");
    Object.assign(rightContent.style, {
        display: "flex",
        gap: "12px",
        flexShrink: "0",
        alignItems: "center"
    });

    const updateBtn = document.createElement("button");
    Object.assign(updateBtn.style, {
        background: "#5865F2",
        border: "none",
        borderRadius: "4px",
        color: "#ffffff",
        padding: "4px 16px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "500",
        fontFamily: "inherit",
        transition: "background 0.2s"
    });
    updateBtn.onmouseenter = () => { if (!installing) updateBtn.style.background = "#4752C4"; };
    updateBtn.onmouseleave = () => { if (!installing) updateBtn.style.background = "#5865F2"; };
    updateBtn.textContent = "Install Now";
    updateBtn.addEventListener("click", doInstall);

    const closeBtn = document.createElement("button");
    Object.assign(closeBtn.style, {
        background: "transparent",
        border: "none",
        color: "#b5bac1",
        cursor: "pointer",
        fontSize: "16px",
        padding: "0 4px",
        fontFamily: "inherit",
        lineHeight: "1",
        transition: "color 0.2s"
    });
    closeBtn.onmouseenter = () => closeBtn.style.color = "#dbdee1";
    closeBtn.onmouseleave = () => closeBtn.style.color = "#b5bac1";
    closeBtn.textContent = "âœ•";
    closeBtn.title = "Dismiss (will auto-install when Discord closes)";
    closeBtn.addEventListener("click", () => {
        if (installing) return; // do not close if installing
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        banner.remove();
        UpdateLogger.info("Update banner dismissed â€” will auto-apply on Discord quit.");
    });

    rightContent.appendChild(updateBtn);
    rightContent.appendChild(closeBtn);

    banner.appendChild(leftContent);
    banner.appendChild(rightContent);

    document.body.appendChild(banner);
}

// Allow triggering from console for testing
// @ts-ignore
window.showYouCordUpdateBanner = showGreenUpdateBanner;

async function runUpdateCheck() {
    if (IS_UPDATER_DISABLED) return;

    try {
        const isOutdated = await checkForUpdates();
        if (IS_DISCORD_DESKTOP) VencordNative.tray.setUpdateState(isOutdated);
        if (!isOutdated) return;

        if (notifiedForUpdatesThisSession) return;
        notifiedForUpdatesThisSession = true;

        // Affiche la banniÃ¨re verte avec auto-install (compte Ã  rebours 10s)
        setTimeout(() => showGreenUpdateBanner(), 8_000);
    } catch (err) {
        UpdateLogger.error("Failed to check for updates", err);
    }
}

function initTrayIpc() {
    if (IS_WEB || IS_UPDATER_DISABLED) return;

    VencordNative.tray.onCheckUpdates(async () => {
        try {
            const isOutdated = await checkForUpdates();
            VencordNative.tray.setUpdateState(isOutdated);

            if (isOutdated) {
                showNotice("A YouCord update is available!", "View Update", () => openSettingsTabModal(UpdaterTab!));
            } else {
                showNotice("No updates available, you're on the latest version!", "OK", popNotice);
            }
        } catch (err) {
            UpdateLogger.error("Failed to check for updates from tray", err);
            showNotice("Failed to check for updates, check the console for more info", "OK", popNotice);
        }
    });

    VencordNative.tray.onRepair(async () => {
        try {
            await update();
            relaunch();
        } catch (err) {
            UpdateLogger.error("Failed to repair YouCord", err);
        }
    });

    VencordNative.tray.setUpdateState(getIsOutdated);
}

async function init() {
    await onceReady;

    startAllPlugins(StartAt.WebpackReady);

    syncSettings();
    initTrayIpc();

    const hasOpened = localStorage.getItem("youcord_telegram_opened");
    if (!hasOpened) {
        localStorage.setItem("youcord_telegram_opened", "true");
        setTimeout(() => {
            Alerts.show({
                title: t("Welcome to YouCord!"),
                body: t("Thank you for installing YouCord. Would you like to join our official Discord server to stay updated?"),
                confirmText: t("Open link"),
                cancelText: t("Cancel"),
                onConfirm: () => {
                    if (window.youcord && typeof window.youcord.openUrl === "function") {
                        window.youcord.openUrl("https://discord.gg/remHHJQRXg");
                    } else {
                        VencordNative.native.openExternal("https://t.me/youcordoff");
                    }
                }
            });
        }, 3000);
    }

    if (!IS_WEB && !IS_UPDATER_DISABLED) {
        runUpdateCheck();
        setInterval(runUpdateCheck, 1000 * 60 * 30); // 30 minutes
    }

    if (IS_DEV) {
        const pendingPatches = patches.filter(p => !p.all && p.predicate?.() !== false);
        if (pendingPatches.length)
            PMLogger.warn(
                "Webpack has finished initialising, but some patches haven't been applied yet.",
                "This might be expected since some Modules are lazy loaded, but please verify",
                "that all plugins are working as intended.",
                "You are seeing this warning because this is a Development build of YouCord.",
                "\nThe following patches have not been applied:",
                "\n\n" + pendingPatches.map(p => `${p.plugin}: ${p.find}`).join("\n")
            );
    }
}

initPluginManager();
initStyles();
startAllPlugins(StartAt.Init);
init();

document.addEventListener("DOMContentLoaded", () => {
    startAllPlugins(StartAt.DOMContentLoaded);

    // Reposition Discord's titlebar to the left by default (90px)
    scheduleIdleCallback(() => {
        createAndAppendStyle("youcord-titlebar-position", coreStyleRootNode).textContent = `
            body:not(.youcord-stealth):not(.youcord-compact) [class*="title_c38"] {
                position: absolute !important;
                left: 90px !important;
                right: auto !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                text-align: left !important;
                margin: 0 !important;
            }
        `;

        if (IS_DISCORD_DESKTOP && Settings.winNativeTitleBar && IS_WINDOWS) {
            createAndAppendStyle("vencord-native-titlebar-style", coreStyleRootNode).textContent = "[class*=titleBar]{display: none!important}";
        }
    });
}, { once: true });
