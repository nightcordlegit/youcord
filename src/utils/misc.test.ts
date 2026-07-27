/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import {
    classes,
    identity,
    interpolateIfDefined,
    isObject,
    isObjectEmpty,
    parseUrl,
    pluralise,
    removeFromArray,
    tryOrElse,
} from "./misc";

describe("classes", () => {
    it("joins truthy strings with space", () => {
        expect(classes("a", "b", "c")).toBe("a b c");
    });

    it("filters out falsy values", () => {
        expect(classes("a", false, null, undefined, "b")).toBe("a b");
    });

    it("returns empty string for no args", () => {
        expect(classes()).toBe("");
    });

    it("returns empty string when all falsy", () => {
        expect(classes(false, null, undefined)).toBe("");
    });
});

describe("isObject", () => {
    it("returns true for plain objects", () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
    });

    it("returns false for null", () => {
        expect(isObject(null)).toBe(false);
    });

    it("returns false for arrays", () => {
        expect(isObject([])).toBe(false);
        expect(isObject([1, 2])).toBe(false);
    });

    it("returns false for primitives", () => {
        expect(isObject("string")).toBe(false);
        expect(isObject(42)).toBe(false);
        expect(isObject(true)).toBe(false);
        expect(isObject(undefined)).toBe(false);
    });
});

describe("isObjectEmpty", () => {
    it("returns true for empty object", () => {
        expect(isObjectEmpty({})).toBe(true);
    });

    it("returns false for non-empty object", () => {
        expect(isObjectEmpty({ a: 1 })).toBe(false);
    });

    it("returns true for Object.create(null)", () => {
        expect(isObjectEmpty(Object.create(null))).toBe(true);
    });
});

describe("parseUrl", () => {
    it("parses a valid URL", () => {
        const url = parseUrl("https://example.com/path?q=1");
        expect(url).toBeInstanceOf(URL);
        expect(url!.href).toBe("https://example.com/path?q=1");
    });

    it("returns null for invalid URL", () => {
        expect(parseUrl("not-a-url")).toBeNull();
        expect(parseUrl("")).toBeNull();
    });
});

describe("identity", () => {
    it("returns the same value", () => {
        const obj = {};
        expect(identity(42)).toBe(42);
        expect(identity("hello")).toBe("hello");
        expect(identity(obj)).toBe(obj);
        expect(identity(null)).toBeNull();
    });
});

describe("pluralise", () => {
    it("uses singular for 1", () => {
        expect(pluralise(1, "apple")).toBe("1 apple");
    });

    it("uses plural for 0", () => {
        expect(pluralise(0, "apple")).toBe("0 apples");
    });

    it("uses plural for >1", () => {
        expect(pluralise(5, "apple")).toBe("5 apples");
    });

    it("uses custom plural form", () => {
        expect(pluralise(2, "child", "children")).toBe("2 children");
    });
});

describe("interpolateIfDefined", () => {
    it("interpolates when all args defined", () => {
        const result = interpolateIfDefined(["Hello ", ""], "World");
        expect(result).toBe("Hello World");
    });

    it("returns empty string when any arg is null", () => {
        expect(interpolateIfDefined(["Hello ", ""], null)).toBe("");
    });

    it("returns empty string when any arg is undefined", () => {
        expect(interpolateIfDefined(["Hello ", ""], undefined)).toBe("");
    });
});

describe("tryOrElse", () => {
    it("returns function result on success", () => {
        expect(tryOrElse(() => 42, 0)).toBe(42);
    });

    it("returns fallback on throw", () => {
        expect(tryOrElse(() => { throw new Error("fail"); }, "fallback")).toBe("fallback");
    });

    it("returns fallback on async rejection", async () => {
        const result = tryOrElse(
            () => Promise.reject(new Error("fail")),
            "fallback"
        );
        await expect(result).resolves.toBe("fallback");
    });

    it("returns async result on success", async () => {
        const result = tryOrElse(
            () => Promise.resolve(42),
            0
        );
        await expect(result).resolves.toBe(42);
    });
});

describe("removeFromArray", () => {
    it("removes element matching predicate", () => {
        const arr = [1, 2, 3, 4];
        removeFromArray(arr, (n: number) => n === 3);
        expect(arr).toEqual([1, 2, 4]);
    });

    it("removes only first match", () => {
        const arr = [1, 2, 3, 3, 4];
        removeFromArray(arr, (n: number) => n === 3);
        expect(arr).toEqual([1, 2, 3, 4]);
    });

    it("does nothing if no match", () => {
        const arr = [1, 2, 3];
        removeFromArray(arr, (n: number) => n === 99);
        expect(arr).toEqual([1, 2, 3]);
    });

    it("works on empty array", () => {
        const arr: number[] = [];
        removeFromArray(arr, (n: number) => n === 1);
        expect(arr).toEqual([]);
    });
});
