/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { onlyOnce } from "./onlyOnce";

describe("onlyOnce", () => {
    it("calls the function only once", () => {
        let count = 0;
        const fn = onlyOnce(() => ++count);

        expect(fn()).toBe(1);
        expect(fn()).toBe(1);
        expect(fn()).toBe(1);
        expect(count).toBe(1);
    });

    it("returns the same result on subsequent calls", () => {
        const fn = onlyOnce(() => ({ key: "value" }));

        const result1 = fn();
        const result2 = fn();
        expect(result1).toBe(result2);
    });

    it("preserves the return value of the original function", () => {
        const fn = onlyOnce(() => 42);
        expect(fn()).toBe(42);
    });

    it("preserves the this context", () => {
        const obj = {
            value: 10,
            getValue: onlyOnce(function (this: any) {
                return this.value;
            }),
        };

        expect(obj.getValue()).toBe(10);
        expect(obj.getValue()).toBe(10);
    });

    it("passes arguments through", () => {
        const fn = onlyOnce((a: number, b: number) => a + b);
        expect(fn(1, 2)).toBe(3);
        expect(fn(3, 4)).toBe(3);
    });

    it("works with functions that return undefined", () => {
        let called = false;
        const fn = onlyOnce(() => { called = true; });

        expect(fn()).toBeUndefined();
        expect(called).toBe(true);
        fn();
        expect(called).toBe(true);
    });
});
