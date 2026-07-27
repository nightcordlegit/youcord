/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it, vi } from "vitest";

import { SettingsStore, SYM_GET_RAW_TARGET,SYM_IS_PROXY } from "./SettingsStore";

describe("SettingsStore", () => {
    it("creates a store with initial data", () => {
        const store = new SettingsStore({ a: 1, b: "hello" });
        expect(store.store.a).toBe(1);
        expect(store.store.b).toBe("hello");
    });

    it("setting a value triggers listeners", () => {
        const store = new SettingsStore({ count: 0 });
        const listener = vi.fn();

        store.addChangeListener("count", listener);
        store.store.count = 5;

        expect(listener).toHaveBeenCalledWith(5);
    });

    it("setting same value does not trigger listeners", () => {
        const store = new SettingsStore({ count: 0 });
        const listener = vi.fn();

        store.addChangeListener("count", listener);
        store.store.count = 0;

        expect(listener).not.toHaveBeenCalled();
    });

    it("global listeners fire on any change", () => {
        const store = new SettingsStore({ a: 1, b: 2 });
        const listener = vi.fn();

        store.addGlobalChangeListener(listener);
        store.store.a = 10;

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ a: 10, b: 2 }),
            "a"
        );
    });

    it("path listeners fire on nested changes", () => {
        const store = new SettingsStore({ plugins: { test: { enabled: false } } });
        const listener = vi.fn();

        store.addChangeListener("plugins.test.enabled", listener);
        store.store.plugins.test.enabled = true;

        expect(listener).toHaveBeenCalledWith(true);
    });

    it("global listeners fire on plugin path changes", () => {
        const store = new SettingsStore({ plugins: { myPlugin: { setting: "old" } } });
        const listener = vi.fn();

        store.addGlobalChangeListener(listener);
        store.store.plugins.myPlugin.setting = "new";

        // Global listeners get called with (root, path)
        expect(listener).toHaveBeenCalled();
    });

    it("readOnly prevents setData", () => {
        const store = new SettingsStore({ a: 1 }, { readOnly: true });

        expect(() => store.setData({ a: 2 })).toThrow("SettingsStore is read-only");
    });

    it("setData updates the store", () => {
        const store = new SettingsStore({ a: 1 });
        store.setData({ a: 2 });

        expect(store.store.a).toBe(2);
        expect(store.plain.a).toBe(2);
    });

    it("setData with pathToNotify notifies listeners", () => {
        const store = new SettingsStore({ a: { b: 1 } });
        const listener = vi.fn();

        store.addChangeListener("a.b", listener);
        store.setData({ a: { b: 2 } }, "a.b");

        expect(listener).toHaveBeenCalledWith(2);
    });

    it("prefix listeners fire on any change under that prefix", () => {
        const store = new SettingsStore({ foo: { bar: 1, baz: 2 } });
        const listener = vi.fn();

        store.addPrefixChangeListener("foo", listener);
        store.store.foo.bar = 10;

        expect(listener).toHaveBeenCalledWith(10, "foo.bar");
    });

    it("removing a listener works", () => {
        const store = new SettingsStore({ count: 0 });
        const listener = vi.fn();

        store.addChangeListener("count", listener);
        store.removeChangeListener("count", listener);
        store.store.count = 5;

        expect(listener).not.toHaveBeenCalled();
    });

    it("removing a global listener works", () => {
        const store = new SettingsStore({ count: 0 });
        const listener = vi.fn();

        store.addGlobalChangeListener(listener);
        store.removeGlobalChangeListener(listener);
        store.store.count = 5;

        expect(listener).not.toHaveBeenCalled();
    });

    it("proxy symbols work", () => {
        const store = new SettingsStore({ a: 1 });

        expect(store.store[SYM_IS_PROXY]).toBe(true);
        expect(store.store[SYM_GET_RAW_TARGET]).toBe(store.plain);
    });

    it("deleting a property triggers listeners", () => {
        const store = new SettingsStore({ a: 1, b: 2 });
        const listener = vi.fn();

        store.addChangeListener("b", listener);
        // @ts-ignore
        delete store.store.b;

        expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("markAsChanged triggers global listeners", () => {
        const store = new SettingsStore({ a: 1 });
        const listener = vi.fn();

        store.addGlobalChangeListener(listener);
        store.markAsChanged();

        expect(listener).toHaveBeenCalledWith(store.plain, "");
    });
});
