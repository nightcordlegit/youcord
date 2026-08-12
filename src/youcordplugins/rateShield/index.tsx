/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    minDelayMs: {
        type: OptionType.NUMBER,
        description: "Minimum delay between Discord REST requests (ms)",
        default: 400,
    },
    maxReqPerMin: {
        type: OptionType.NUMBER,
        description: "Hard cap of requests per minute (0 = unlimited)",
        default: 0,
    },
    pauseOn429: {
        type: OptionType.BOOLEAN,
        description: "Automatically pause all requests after a 429 (rate limit)",
        default: true,
    },
});

// ── État global ────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "RateShield",
    enabledByDefault: false,
    description: "Legacy REST guard, disabled because Discord handles rate limits internally.",
    authors: [{ name: "YouCord", id: 0n }],

    settings,

});
