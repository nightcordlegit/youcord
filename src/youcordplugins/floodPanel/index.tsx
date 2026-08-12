/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import { FloodPanelButton } from "./components/ChatBarButton";
import { FloodIcon } from "./components/Icons";

const settings = definePluginSettings({
    defaultDelay: {
        type: OptionType.NUMBER,
        description: "Délai par défaut entre les messages (ms).",
        default: 1200
    },
    defaultShuffle: {
        type: OptionType.BOOLEAN,
        description: "Mélanger l’ordre des messages par défaut.",
        default: true
    },
    customMessages: {
        type: OptionType.CUSTOM,
        default: [] as string[],
        hidden: true,
        description: ""
    },
    customFileName: {
        type: OptionType.CUSTOM,
        default: null as string | null,
        hidden: true,
        description: ""
    },
    customDelay: {
        type: OptionType.CUSTOM,
        default: "1200" as string,
        hidden: true,
        description: ""
    },
    customShuffle: {
        type: OptionType.CUSTOM,
        default: true as boolean,
        hidden: true,
        description: ""
    }
});

export { settings };

export default definePlugin({
    name: "FloodPanel",
    description: "Envoie une série de messages dans un salon avec un délai de sécurité. Utilise les phrases intégrées ou une liste personnalisée.",
    authors: [EquicordDevs.nobody],
    enabledByDefault: false,
    settings,

    chatBarButton: {
        icon: FloodIcon,
        render: FloodPanelButton
    },
});
