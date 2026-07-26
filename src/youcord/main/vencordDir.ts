/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app } from "electron";
import { join } from "path";

// this is in a separate file to avoid circular dependencies
const PACKAGED_PATH = app.isPackaged
    ? join(process.resourcesPath, "youcord.asar")
    : null;

const DEV_PATH = join(__dirname, "..", "..", "..", "dist", "youcord.asar");

export const VENCORD_DIR = PACKAGED_PATH ?? DEV_PATH;

export const VENCORD_FALLBACK_DIR = app.isPackaged
    ? join(app.getPath("userData"), "youcord.asar")
    : null;
