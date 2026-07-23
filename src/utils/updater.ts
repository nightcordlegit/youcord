/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "./Logger";
import { IpcRes } from "./types";

export const UpdateLogger = /* #__PURE__ */ new Logger("Updater", "white");
export let isOutdated = false;
export const isNewer = false;
export let updateError: any;
export let changes: Record<"hash" | "author" | "message", string>[] = [];

async function Unwrap<T>(p: Promise<IpcRes<T>>): Promise<T> {
    const res = await p;
    if (res.ok) return res.value as T;
    updateError = res.error;
    throw res.error;
}

/**
 * Demande au main process s'il y a une version plus rÃ©cente.
 * Met Ã  jour isOutdated et changes.
 */
export async function checkForUpdates(): Promise<boolean> {
    changes = await Unwrap(VencordNative.updater.getUpdates());
    return (isOutdated = changes.length > 0);
}

/**
 * TÃ©lÃ©charge le Setup.exe (Ã©tape 1).
 * Retourne true si le tÃ©lÃ©chargement a rÃ©ussi.
 */
export async function update(): Promise<boolean> {
    if (!isOutdated) return true;
    const ok = await Unwrap(VencordNative.updater.update());
    if (ok) isOutdated = false;
    return ok;
}

/**
 * Lance l'installeur tÃ©lÃ©chargÃ© (Ã©tape 2).
 * L'app va se fermer et se relancer automatiquement aprÃ¨s installation.
 */
export async function rebuild(): Promise<boolean> {
    return Unwrap(VencordNative.updater.rebuild());
}

export const getRepo = () => Unwrap(VencordNative.updater.getRepo());

/**
 * VÃ©rifie les mises Ã  jour au dÃ©marrage et propose Ã  l'utilisateur de mettre Ã  jour.
 */
export async function maybePromptToUpdate(confirmMessage: string, checkForDev = false) {
    if (IS_WEB || IS_UPDATER_DISABLED) return;
    if (checkForDev && IS_DEV) return;

    try {
        const outdated = await checkForUpdates();
        if (outdated) {
            // Mise Ã  jour automatique sans confirmation
            const downloaded = await update();
            if (downloaded) await rebuild();
        }
    } catch (err) {
        UpdateLogger.error(err);
        alert("La vÃ©rification des mises Ã  jour a Ã©chouÃ©. VÃ©rifie ta connexion ou rÃ©installe YouCord.");
    }
}
