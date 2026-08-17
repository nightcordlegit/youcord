/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showBadge: {
        type: OptionType.BOOLEAN,
        description: "Afficher le badge YouCord Premium sur ton profil",
        default: true,
        restartNeeded: false
    }
});
