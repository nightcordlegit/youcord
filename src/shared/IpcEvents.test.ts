/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { IpcCommands, IpcEvents, UpdaterIpcEvents } from "./IpcEvents";

describe("IpcEvents", () => {
    it("all events have string values", () => {
        const values = Object.values(IpcEvents);
        expect(values.length).toBeGreaterThan(0);

        for (const v of values) {
            expect(typeof v).toBe("string");
            expect(v.length).toBeGreaterThan(0);
        }
    });

    it("all event values follow naming convention", () => {
        const values = Object.values(IpcEvents);

        for (const v of values) {
            const name = v as string;
            expect(name).toMatch(/^(Vencord|YouCord|SoundCord|Vesktop|VCD_)/);
        }
    });

    it("no duplicate event values", () => {
        const values = Object.values(IpcEvents).map(v => v as string);
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });
});

describe("UpdaterIpcEvents", () => {
    it("all events have the VCD_ prefix", () => {
        const values = Object.values(UpdaterIpcEvents);
        for (const v of values) {
            expect(v).toMatch(/^VCD_UPDATER_/);
        }
    });

    it("no duplicate values", () => {
        const values = Object.values(UpdaterIpcEvents);
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });
});

describe("IpcCommands", () => {
    it("all commands follow the prefix:action or prefix.pattern pattern", () => {
        const values = Object.values(IpcCommands);
        for (const v of values) {
            expect(v).toMatch(/^[a-z]+(:|\..+)/);
        }
    });

    it("no duplicate values", () => {
        const values = Object.values(IpcCommands);
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });
});
