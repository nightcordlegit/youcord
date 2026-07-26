/*
 * YouCord, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execSync } from "child_process";
import { build, BuildOptions } from "esbuild";
import { copyFile } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

import vencordDep from "./vencordDep.mts";
import { includeDirPlugin } from "./includeDirPlugin.mts";

const isDev = process.argv.includes("--dev");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let gitHash: string;
try {
    gitHash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
} catch {
    gitHash = "unknown";
}

const CommonOpts: BuildOptions = {
    minify: !isDev,
    bundle: true,
    sourcemap: !isDev ? false : "linked",
    drop: !isDev ? ["console", "debugger"] : undefined,
    logLevel: "info"
};

const NodeCommonOpts: BuildOptions = {
    ...CommonOpts,
    format: "cjs",
    platform: "node",
    external: ["electron", "original-fs"],
    target: ["esnext"],
    loader: {
        ".node": "file"
    },
    define: {
        IS_DEV: JSON.stringify(isDev),
        EQUIBOP_GIT_HASH: JSON.stringify(gitHash)
    }
};

const watch = process.argv.includes("--watch");

if (watch) {
    const { context } = await import("esbuild");
    const contexts = [
        await context({ ...NodeCommonOpts, entryPoints: ["src/youcord/main/index.ts"], outfile: "dist/js/main.js", footer: { js: "//# sourceURL=VesktopMain" } }),
        await context({ ...NodeCommonOpts, entryPoints: ["src/youcord/preload/index.ts"], outfile: "dist/js/preload.js", footer: { js: "//# sourceURL=VesktopPreload" } }),
        await context({ ...NodeCommonOpts, entryPoints: ["src/youcord/preload/splash.ts"], outfile: "dist/js/splashPreload.js", footer: { js: "//# sourceURL=VesktopSplashPreload" } }),
        await context({ ...NodeCommonOpts, entryPoints: ["src/youcord/preload/updater.ts"], outfile: "dist/js/updaterPreload.js", footer: { js: "//# sourceURL=VesktopUpdaterPreload" } }),
        await context({
            ...CommonOpts,
            globalName: "Equibop",
            entryPoints: ["src/youcord/renderer/index.ts"],
            outfile: "dist/js/renderer.js",
            format: "iife",
            inject: ["./scripts/build/injectReact.mjs"],
            jsxFactory: "VencordCreateElement",
            jsxFragment: "VencordFragment",
            external: ["@YouCord/types/*", "@youcord/types/*"],
            plugins: [vencordDep, includeDirPlugin("patches", "src/youcord/renderer/patches")],
            footer: { js: "//# sourceURL=VesktopRenderer" }
        })
    ];
    await Promise.all(contexts.map(ctx => ctx.watch()));
} else {
    const start = Date.now();

    // Use build() API (not context().rebuild()) to avoid hangs on Windows
    const results = await Promise.all([
        build({ ...NodeCommonOpts, entryPoints: ["src/youcord/main/index.ts"], outfile: "dist/js/main.js", footer: { js: "//# sourceURL=VesktopMain" } }),
        build({ ...NodeCommonOpts, entryPoints: ["src/youcord/preload/index.ts"], outfile: "dist/js/preload.js", footer: { js: "//# sourceURL=VesktopPreload" } }),
        build({ ...NodeCommonOpts, entryPoints: ["src/youcord/preload/splash.ts"], outfile: "dist/js/splashPreload.js", footer: { js: "//# sourceURL=VesktopSplashPreload" } }),
        build({ ...NodeCommonOpts, entryPoints: ["src/youcord/preload/updater.ts"], outfile: "dist/js/updaterPreload.js", footer: { js: "//# sourceURL=VesktopUpdaterPreload" } }),
        build({
            ...CommonOpts,
            globalName: "Equibop",
            entryPoints: ["src/youcord/renderer/index.ts"],
            outfile: "dist/js/renderer.js",
            format: "iife",
            inject: ["./scripts/build/injectReact.mjs"],
            jsxFactory: "VencordCreateElement",
            jsxFragment: "VencordFragment",
            external: ["@YouCord/types/*", "@youcord/types/*"],
            plugins: [vencordDep, includeDirPlugin("patches", "src/youcord/renderer/patches")],
            footer: { js: "//# sourceURL=VesktopRenderer" }
        })
    ]);

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    for (const result of results) {
        if (result.metafile) {
            const outputs = Object.keys(result.metafile.outputs);
            for (const output of outputs) {
                const meta = result.metafile.outputs[output];
                const size = (meta.bytes / 1024).toFixed(2);
                console.log(`  ${output} ${size} KB`);
            }
        }
    }

    console.log(`\nBuild complete in ${elapsed}s`);
}
