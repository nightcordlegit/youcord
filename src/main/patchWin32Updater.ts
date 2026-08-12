/*
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

import { app } from "electron";
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from "original-fs";
import { basename, dirname, join } from "path";

function isNewer($new: string, old: string) {
    const newParts = $new.slice(4).split(".").map(Number);
    const oldParts = old.slice(4).split(".").map(Number);

    for (let i = 0; i < oldParts.length; i++) {
        if (newParts[i] > oldParts[i]) return true;
        if (newParts[i] < oldParts[i]) return false;
    }
    return false;
}

// The absolute path to OUR OWN bundle (this very file, once compiled to
// dist/desktop/patcher.js). This is exactly what the injector's index.js
// require()'d to get us running in the first place, regardless of how
// YouCord was installed (dev-inject asar, the PS1/Inno installer, or
// Equilotl) — so it's the only value that's guaranteed to be correct.
declare const __filename: string;
const OUR_PATCHER_PATH = __filename;

function patchLatest() {
    try {
        const currentAppPath = dirname(process.execPath);
        const currentVersion = basename(currentAppPath);
        const discordPath = join(currentAppPath, "..");

        const latestVersion = readdirSync(discordPath)
            .filter(name => name.startsWith("app-") && statSync(join(discordPath, name)).isDirectory())
            .reduce((prev, curr) => isNewer(curr, prev) ? curr : prev, currentVersion as string);

        if (latestVersion === currentVersion) return;

        const resources = join(discordPath, latestVersion, "resources");
        const appAsar = join(resources, "app.asar");
        const _appAsar = join(resources, "_app.asar");

        if (!existsSync(appAsar) || statSync(appAsar).isDirectory()) return;

        console.info("[YouCord] Detected Host Update. Repatching...");

        renameSync(appAsar, _appAsar);
        mkdirSync(appAsar);
        writeFileSync(join(appAsar, "package.json"), JSON.stringify({
            name: "discord",
            main: "index.js"
        }));

        // Absolute path to our real patcher bundle (see OUR_PATCHER_PATH above),
        // with a try/catch fallback to vanilla Discord if anything goes wrong —
        // so a failed repatch can never crash the new Discord version or leave
        // it stuck relaunching into a broken/duplicate state.
        const indexJs = [
            "// YouCord repatch",
            "\"use strict\";",
            "const path = require(\"path\");",
            "const fs = require(\"fs\");",
            "try {",
            `    require(${JSON.stringify(OUR_PATCHER_PATH)});`,
            "} catch (e) {",
            "    console.error(\"[YouCord] Repatch injection failed, falling back to vanilla Discord:\", e);",
            "    const originalAsar = path.join(__dirname, \"..\", \"_app.asar\");",
            "    if (fs.existsSync(originalAsar)) {",
            "        require(originalAsar);",
            "    }",
            "}",
            ""
        ].join("\n");

        writeFileSync(join(appAsar, "index.js"), indexJs);
    } catch (err) {
        console.error("[YouCord] Failed to repatch latest host update", err);
    }
}

// Try to patch latest on before-quit
// Discord's Win32 updater will call app.quit() on restart and open new version on will-quit
app.on("before-quit", patchLatest);
