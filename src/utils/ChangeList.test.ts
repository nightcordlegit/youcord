import { describe, expect, it } from "vitest";
import { ChangeList } from "./ChangeList";

describe("ChangeList", () => {
    it("starts empty", () => {
        const cl = new ChangeList<string>();
        expect(cl.changeCount).toBe(0);
        expect(cl.hasChanges).toBe(false);
    });

    it("adds items", () => {
        const cl = new ChangeList<string>();
        cl.add("a");
        expect(cl.hasChanges).toBe(true);
        expect(cl.changeCount).toBe(1);
    });

    it("removes items", () => {
        const cl = new ChangeList<string>();
        cl.add("a");
        cl.remove("a");
        expect(cl.hasChanges).toBe(false);
        expect(cl.changeCount).toBe(0);
    });

    it("handleChange toggles items", () => {
        const cl = new ChangeList<string>();

        cl.handleChange("a");
        expect(cl.changeCount).toBe(1);

        cl.handleChange("a");
        expect(cl.changeCount).toBe(0);
    });

    it("handleChange adds and removes correctly", () => {
        const cl = new ChangeList<string>();

        cl.handleChange("a");
        cl.handleChange("b");
        expect(cl.changeCount).toBe(2);

        cl.handleChange("a");
        expect(cl.changeCount).toBe(1);
        expect([...cl.getChanges()]).toEqual(["b"]);
    });

    it("getChanges returns all items", () => {
        const cl = new ChangeList<string>();
        cl.add("a");
        cl.add("b");
        cl.add("c");

        const changes = [...cl.getChanges()];
        expect(changes).toContain("a");
        expect(changes).toContain("b");
        expect(changes).toContain("c");
    });

    it("map transforms items", () => {
        const cl = new ChangeList<string>();
        cl.add("a");
        cl.add("b");

        const result = cl.map((v: string) => v.toUpperCase());
        expect(result).toContain("A");
        expect(result).toContain("B");
    });

    it("map works on empty list", () => {
        const cl = new ChangeList<string>();
        expect(cl.map((v: string) => v)).toEqual([]);
    });
});
