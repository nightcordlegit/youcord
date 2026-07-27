/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { mergeDefaults } from "./mergeDefaults";

describe("mergeDefaults", () => {
    it("fills missing keys from defaults", () => {
        const obj: any = { a: 1 };
        mergeDefaults(obj, { a: 1, b: 2 });
        expect(obj).toEqual({ a: 1, b: 2 });
    });

    it("does not overwrite existing keys", () => {
        const obj: any = { a: 2 };
        mergeDefaults(obj, { a: 1, b: 2 });
        expect(obj).toEqual({ a: 2, b: 2 });
    });

    it("recursively merges nested objects", () => {
        const obj: any = { outer: { inner: "existing" } };
        mergeDefaults(obj, { outer: { inner: "default", other: "new" } });
        expect(obj).toEqual({ outer: { inner: "existing", other: "new" } });
    });

    it("returns the same object reference", () => {
        const obj = { a: 1 };
        const result = mergeDefaults(obj as any, { b: 2 });
        expect(result).toBe(obj);
    });

    it("handles empty defaults", () => {
        const obj = { a: 1 };
        mergeDefaults(obj as any, {});
        expect(obj).toEqual({ a: 1 });
    });

    it("handles empty object", () => {
        const obj: any = {};
        mergeDefaults(obj, { a: 1, b: { c: 2 } });
        expect(obj).toEqual({ a: 1, b: { c: 2 } });
    });

    it("does not merge arrays", () => {
        const obj: any = { items: [1] };
        mergeDefaults(obj, { items: [2, 3] });
        expect(obj.items).toEqual([1]);
    });
});
