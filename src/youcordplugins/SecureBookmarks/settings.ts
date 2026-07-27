/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tPlugin as t } from "@api/pluginI18n";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const PASSWORD_KEYS: Array<"usePassword" | "password"> = ["usePassword", "password"];

export const settings = definePluginSettings({
    usePassword: {
        type: OptionType.BOOLEAN,
        description: t("Encrypt new bookmarks and require password access for encrypted bookmarks."),
        default: true
    },
    password: {
        type: OptionType.STRING,
        description: t("Password used for AES-256 encrypted bookmarks."),
        default: "",
        placeholder: t("Bookmark password"),
        componentProps: {
            type: "password",
            autoComplete: "new-password"
        }
    }
}, {
    password: {
        // @ts-ignore
        hidden() {
            // @ts-ignore
            return !this.store.usePassword;
        },
        // @ts-ignore
        isValid(value: string) {
            // @ts-ignore
            if (!this.store.usePassword) return true;
            if (!value) return t("Password cannot be empty.");
            if (/[\r\n]/.test(value)) return t("Password cannot contain line breaks.");
            return true;
        }
    }
});
