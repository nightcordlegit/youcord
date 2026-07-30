/*
 * YouCord — Installer via injection directe
 * Injection directe sans dépendance à EquilotlCli.exe.
 *
 * Usage:
 *   pnpm inject    → installe YouCord dans Discord
 *   pnpm uninject  → désinstalle YouCord de Discord
 *   pnpm repair    → répare l'installation
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./checkNodeVersion.js";

import { execSync, exec } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(BASE_DIR, "dist", "desktop");

// ── Vérifier que le build existe ─────────────────────────────────────────────
function checkBuild() {
    const patcherPath = join(DIST_DIR, "patcher.js");
    if (!existsSync(patcherPath)) {
        console.error("\x1b[31m[YouCord] dist/desktop/patcher.js not found!\x1b[0m");
        console.error("\x1b[33m           Run 'pnpm build' first, then try again.\x1b[0m");
        process.exit(1);
    }
}

// ── Suppression des mises à jour Discord incomplètes ─────────────────────────
function cleanIncompleteDiscordUpdates() {
    if (process.platform !== "win32") return;
    const localAppData = process.env.LOCALAPPDATA || "";
    for (const channel of ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"]) {
        const base = join(localAppData, channel);
        if (!existsSync(base)) continue;
        let versions;
        try { versions = readdirSync(base).filter(d => /^app-\d+\.\d+\.\d+$/.test(d)); }
        catch { continue; }
        for (const ver of versions) {
            const resourcesDir = join(base, ver, "resources");
            const appAsarPath  = join(resourcesDir, "app.asar");
            const backupPath   = join(resourcesDir, "_app.asar");
            if (existsSync(join(base, ver)) && !existsSync(appAsarPath) && !existsSync(backupPath)) {
                try {
                    rmSync(join(base, ver), { recursive: true, force: true });
                    console.log(`[YouCord] Removed incomplete Discord update: ${join(base, ver)}`);
                } catch (e) {
                    console.warn(`[YouCord] Cannot remove ${join(base, ver)}: ${e.message}`);
                }
            }
        }
    }
}

// ── Nettoyage des injections précédentes ────────────────────────────────────
function cleanOldYouCord(isUninstall) {
    console.log("[YouCord] Cleaning previous installations...");
    const platform = process.platform;
    const candidates = [];

    if (platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || "";
        for (const channel of ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"]) {
            const base = join(localAppData, channel);
            if (!existsSync(base)) continue;
            try {
                const versions = readdirSync(base).filter(d => /^app-\d+\.\d+\.\d+$/.test(d));
                for (const ver of versions) candidates.push(join(base, ver, "resources"));
            } catch { }
        }
    } else if (platform === "darwin") {
        candidates.push(
            "/Applications/Discord.app/Contents/Resources",
            "/Applications/Discord PTB.app/Contents/Resources",
            "/Applications/Discord Canary.app/Contents/Resources"
        );
    } else if (platform === "linux") {
        candidates.push(
            "/usr/share/discord/resources",
            "/usr/lib/discord/resources",
            "/opt/discord/resources",
            "/opt/Discord/resources",
            join(process.env.HOME || "", ".local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources"),
            "/snap/discord/current/usr/share/discord/resources"
        );
    }

    let cleanedAny = false;

    for (const resourcesDir of candidates) {
        if (!existsSync(resourcesDir)) continue;

        const appDirPath  = join(resourcesDir, "app");
        const backupPath  = join(resourcesDir, "_app.asar");
        const appAsarPath = join(resourcesDir, "app.asar");

        try {
            if (existsSync(appDirPath)) {
                let isYouCord = false;
                try {
                    const pkgFile = join(appDirPath, "package.json");
                    const indexFile = join(appDirPath, "index.js");
                    if (existsSync(indexFile)) {
                        const indexContent = readFileSync(indexFile, "utf-8");
                        if (indexContent.includes("YouCord")) isYouCord = true;
                    }
                    if (!isYouCord && existsSync(pkgFile)) {
                        const pkg = JSON.parse(readFileSync(pkgFile, "utf-8"));
                        if (pkg.name === "youcord") isYouCord = true;
                    }
                } catch { }

                if (isYouCord) {
                    rmSync(appDirPath, { recursive: true, force: true });
                    console.log(`[YouCord] Removed previous YouCord injection in ${resourcesDir}`);
                    cleanedAny = true;
                } else if (existsSync(backupPath)) {
                    // If there's a backup but no YouCord app dir, still safe to cleanup
                    rmSync(appDirPath, { recursive: true, force: true });
                    console.log(`[YouCord] Removed unknown app/ folder in ${resourcesDir}`);
                    cleanedAny = true;
                }
            }

            if (!isUninstall && existsSync(backupPath)) {
                if (existsSync(appAsarPath)) {
                    rmSync(appAsarPath, { recursive: true, force: true });
                }
                renameSync(backupPath, appAsarPath);
                console.log(`[YouCord] Restored _app.asar → app.asar in ${resourcesDir}`);
                cleanedAny = true;
            }

        } catch (e) {
            console.error(`[YouCord] Error cleaning ${resourcesDir}:`, e.message);
        }
    }

    if (cleanedAny) {
        console.log("[YouCord] Cleanup done.");
    } else {
        console.log("[YouCord] Nothing to clean.");
    }
}

// ── Injection directe (sans Equilotl) ──────────────────────────────────────
function findDiscordResources() {
    const platform = process.platform;
    const candidates = [];

    if (platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || "";
        for (const channel of ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"]) {
            const base = join(localAppData, channel);
            if (!existsSync(base)) continue;
            try {
                const versions = readdirSync(base)
                    .filter(d => /^app-\d+\.\d+\.\d+$/.test(d))
                    .sort()
                    .reverse();
                for (const ver of versions) {
                    candidates.push(join(base, ver, "resources"));
                }
            } catch { }
        }
    } else if (platform === "darwin") {
        candidates.push(
            "/Applications/Discord.app/Contents/Resources",
            "/Applications/Discord PTB.app/Contents/Resources",
            "/Applications/Discord Canary.app/Contents/Resources"
        );
    } else if (platform === "linux") {
        candidates.push(
            "/usr/share/discord/resources",
            "/usr/lib/discord/resources",
            "/opt/discord/resources",
            "/opt/Discord/resources",
            join(process.env.HOME || "", ".local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources"),
            "/snap/discord/current/usr/share/discord/resources"
        );
    }

    return candidates.filter(p => {
        if (!existsSync(p)) return false;
        return existsSync(join(p, "app.asar")) || existsSync(join(p, "app")) || existsSync(join(p, "_app.asar"));
    });
}

function hasThirdPartyMod(resourcesDir) {
    const appDirPath = join(resourcesDir, "app");
    if (!existsSync(appDirPath)) return false;
    try {
        const pkgFile = join(appDirPath, "package.json");
        if (!existsSync(pkgFile)) return false;
        const pkgContent = readFileSync(pkgFile, "utf-8");
        return pkgContent.includes("vencord") || pkgContent.includes("equicord") || pkgContent.includes("openasar");
    } catch {
        return false;
    }
}

function killDiscord(resourcesDir) {
    if (process.platform !== "win32") return;
    const procName = resourcesDir.includes("DiscordPTB") ? "DiscordPTB" :
                     resourcesDir.includes("DiscordCanary") ? "DiscordCanary" :
                     resourcesDir.includes("DiscordDevelopment") ? "DiscordDevelopment" : "Discord";
    try {
        execSync(`taskkill /F /IM ${procName}.exe /T 2>nul`, { stdio: "ignore" });
        execSync(`taskkill /F /IM Update.exe /T 2>nul`, { stdio: "ignore" });
    } catch { }
    console.log(`[YouCord] Killed ${procName} process.`);
}

function injectDirect(resourcesDir) {
    const appAsarPath = join(resourcesDir, "app.asar");
    const backupPath = join(resourcesDir, "_app.asar");
    const appDirPath = join(resourcesDir, "app");

    // Check if already injected by YouCord
    if (existsSync(appDirPath) && existsSync(join(appDirPath, "index.js"))) {
        try {
            const indexContent = readFileSync(join(appDirPath, "index.js"), "utf-8");
            if (indexContent.includes("YouCord Injector") || indexContent.includes("YouCord")) {
                console.log(`\x1b[33m[YouCord] Already injected in ${resourcesDir}.\x1b[0m`);
                return false;
            }
        } catch { }
    }

    // Check for third-party mod and ask user
    if (hasThirdPartyMod(resourcesDir)) {
        console.log(`\x1b[33m[YouCord] WARNING: Another mod (Vencord/Equicord/OpenAsar) detected in:\x1b[0m`);
        console.log(`\x1b[33m           ${resourcesDir}\x1b[0m`);
        console.log(`\x1b[33m           This mod will be replaced by YouCord.\x1b[0m`);
    }

    // Backup app.asar → _app.asar
    if (existsSync(appAsarPath) && !existsSync(backupPath)) {
        let isDir = false;
        try { isDir = statSync(appAsarPath).isDirectory(); } catch { }
        if (isDir) {
            console.warn(`\x1b[33m[YouCord] app.asar is a directory — another mod may be installed.\x1b[0m`);
            rmSync(appAsarPath, { recursive: true, force: true });
        }
        console.log("[YouCord] Backing up app.asar → _app.asar...");
        renameSync(appAsarPath, backupPath);
    } else if (!existsSync(backupPath)) {
        console.error(`\x1b[31m[YouCord] No app.asar or _app.asar found in resources!\x1b[0m`);
        return false;
    }

    // Remove old app.asar if it exists
    if (existsSync(appAsarPath)) {
        try {
            rmSync(appAsarPath, { recursive: true, force: true });
        } catch (e) {
            console.error(`\x1b[31m[YouCord] Cannot remove old app.asar: ${e.message}\x1b[0m`);
            return false;
        }
    }

    // Create app/ directory with loader
    mkdirSync(appDirPath, { recursive: true });

    const patcherPath = join(DIST_DIR, "patcher.js").replace(/\\/g, "\\\\");
    writeFileSync(join(appDirPath, "package.json"), JSON.stringify({ name: "youcord", main: "index.js" }, null, 2));
    writeFileSync(join(appDirPath, "index.js"),
        `// YouCord Injector — auto-generated, do not edit\n"use strict";\nrequire("${patcherPath}");\n`
    );

    console.log(`\x1b[32m[YouCord] Successfully injected into: ${resourcesDir}\x1b[0m`);
    return true;
}

function launchInjectedDiscord() {
    if (process.platform !== "win32") return;

    const localAppData = process.env.LOCALAPPDATA || "";
    const channels = ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"];

    for (const channel of channels) {
        const base = join(localAppData, channel);
        if (!existsSync(base)) continue;

        let versions;
        try { versions = readdirSync(base).filter(d => /^app-\d+\.\d+\.\d+$/.test(d)); }
        catch { continue; }

        for (const ver of versions) {
            const resourcesDir = join(base, ver, "resources");
            const appDirPath = join(resourcesDir, "app");

            if (existsSync(appDirPath)) {
                const exeName   = channel + ".exe";
                const updateExe = join(base, "Update.exe");

                if (existsSync(updateExe)) {
                    console.log(`[YouCord] Launching ${channel}...`);
                    exec(`"${updateExe}" --processStart ${exeName}`);
                } else {
                    const directExe = join(base, ver, channel + ".exe");
                    if (existsSync(directExe)) {
                        console.log(`[YouCord] Launching ${channel} (direct)...`);
                        exec(`"${directExe}"`);
                    }
                }
                return;
            }
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────
const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? process.argv.slice(2) : process.argv.slice(argStart + 1);

const isUninstall = args.includes("--uninstall");
const isRepair = args.includes("--repair");

cleanIncompleteDiscordUpdates();
cleanOldYouCord(isUninstall);

if (isUninstall) {
    process.exit(0);
}

if (isRepair) {
    console.log("[YouCord] Repair mode: re-injecting...");
}

checkBuild();

// Try direct injection first (no Equilotl dependency)
console.log("[YouCord] Using direct injection (no external binaries)...");

const allResources = findDiscordResources();
if (allResources.length === 0) {
    console.error("\x1b[31m[YouCord] No Discord installation found!\x1b[0m");
    console.error("\x1b[33m[YouCord] Make sure Discord is installed.\x1b[0m");
    process.exit(1);
}

let injectedCount = 0;
for (const resPath of allResources) {
    console.log(`\n[YouCord] → ${resPath}`);
    killDiscord(resPath);
    if (injectDirect(resPath)) injectedCount++;
}

if (injectedCount > 0) {
    console.log(`\n\x1b[32m[YouCord] ${injectedCount}/${allResources.length} injection(s) successful.\x1b[0m`);
    console.log("[YouCord] Launching Discord...");
    launchInjectedDiscord();
} else {
    console.log("\n\x1b[33m[YouCord] No new injections performed. Discord may already be injected.\x1b[0m");
}
