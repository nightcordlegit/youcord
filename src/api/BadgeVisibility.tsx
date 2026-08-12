/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type BadgeSource = "vencord" | "equicord" | "youcord" | "globalbadges" | "illegalcord";

interface CacheEntry {
    fetched: boolean;
    hidden: BadgeSource[];
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 1000;
const CACHE_TTL = 1000 * 60 * 5;
const LOCAL_STORAGE_KEY = "youcord_hidden_badges";

let myHiddenSources: BadgeSource[] = [];
let myUserId: string | null = null;
let loaded = false;

function setCache(userId: string, entry: CacheEntry) {
    if (cache.size >= MAX_CACHE && !cache.has(userId)) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(userId, entry);
}

/**
 * Public badge visibility sync is not deployed. Other users therefore keep
 * the default visibility without issuing a failing request for every profile.
 */
export function getHiddenBadgeSources(userId: string): BadgeSource[] {
    if (myUserId && userId === myUserId) return myHiddenSources;

    const existing = cache.get(userId);
    if (existing?.fetched && Date.now() - existing.timestamp < CACHE_TTL) {
        return existing.hidden;
    }

    setCache(userId, { fetched: true, hidden: [], timestamp: Date.now() });
    return [];
}

/** Load the current user's badge visibility preference from this device. */
export async function loadOwnHiddenBadgeSources(userId: string) {
    myUserId = userId;

    try {
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed)) myHiddenSources = parsed;
        }
    } catch { }

    loaded = true;
    emitBadgeVisibilityChange();
}

/** Save the current user's badge visibility preference on this device. */
export function setOwnHiddenBadgeSources(hidden: BadgeSource[]) {
    myHiddenSources = hidden;

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hidden));
    } catch { }

    emitBadgeVisibilityChange();
}

export function isOwnDataLoaded() {
    return loaded;
}

export function getOwnHiddenBadgeSources(): BadgeSource[] {
    return myHiddenSources;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function addBadgeVisibilityListener(listener: Listener) {
    listeners.add(listener);
}

export function removeBadgeVisibilityListener(listener: Listener) {
    listeners.delete(listener);
}

function emitBadgeVisibilityChange() {
    for (const listener of listeners) {
        try {
            listener();
        } catch { }
    }
}
