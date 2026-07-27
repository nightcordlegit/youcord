import { describe, expect, it, vi } from "vitest";
import { Queue } from "./Queue";

describe("Queue", () => {
    it("executes tasks in order", async () => {
        const queue = new Queue();
        const order: number[] = [];

        queue.push(() => Promise.resolve().then(() => order.push(1)));
        queue.push(() => Promise.resolve().then(() => order.push(2)));
        queue.push(() => Promise.resolve().then(() => order.push(3)));

        await vi.waitFor(() => expect(order).toEqual([1, 2, 3]));
    });

    it("executes synchronous tasks asynchronously", async () => {
        const queue = new Queue();
        const order: number[] = [];

        queue.push(() => { order.push(1); });
        queue.push(() => { order.push(2); });
        queue.push(() => { order.push(3); });

        // Sync tasks are wrapped in Promise.resolve().then(), need to wait for microtasks
        await vi.waitFor(() => expect(order).toEqual([1, 2, 3]));
    });

    it("reports correct size while executing", () => {
        const queue = new Queue();

        expect(queue.size).toBe(0);

        queue.push(async () => {});
        // First task is immediately dequeued for execution
        expect(queue.size).toBe(0);

        queue.push(async () => {});
        expect(queue.size).toBe(1);

        queue.push(async () => {});
        expect(queue.size).toBe(2);
    });

    it("respects maxSize and drops oldest on push", () => {
        const queue = new Queue(2);

        queue.push(async () => {});
        queue.push(async () => {});
        queue.push(async () => {});

        // First was dequeued for execution immediately, second and third remain
        expect(queue.size).toBe(2);
    });

    it("respects maxSize and drops newest on unshift", async () => {
        const queue = new Queue(2);

        queue.unshift(async () => {});
        queue.unshift(async () => {});
        queue.unshift(async () => {});

        // First was dequeued for execution, second and third remain (unshift pops from back when full)
        expect(queue.size).toBe(2);
    });

    it("executes unshift'd task after current executing task", async () => {
        const queue = new Queue();
        const order: number[] = [];

        queue.push(() => Promise.resolve().then(() => order.push(1)));
        // At this point, task 1 is already dequeued and scheduled as microtask
        queue.unshift(() => Promise.resolve().then(() => order.push(0)));

        // Task 1 runs first (already started), then task 0 runs next
        await vi.waitFor(() => expect(order).toEqual([1, 0]));
    });

    it("executes tasks added after previous ones complete", async () => {
        const queue = new Queue();
        const order: number[] = [];

        queue.push(() => Promise.resolve().then(() => order.push(1)));

        await vi.waitFor(() => expect(order).toEqual([1]));

        queue.push(() => Promise.resolve().then(() => order.push(2)));

        await vi.waitFor(() => expect(order).toEqual([1, 2]));
    });

    it("handles errors without stopping the queue", async () => {
        const queue = new Queue();
        const order: number[] = [];

        queue.push(() => { throw new Error("fail"); });
        queue.push(() => Promise.resolve().then(() => order.push(2)));

        await vi.waitFor(() => expect(order).toEqual([2]));
    });

    it("pushes tasks to end and executes in FIFO order", async () => {
        const queue = new Queue();
        const order: number[] = [];

        queue.push(() => Promise.resolve().then(() => order.push(1)));
        queue.push(() => Promise.resolve().then(() => order.push(2)));
        queue.push(() => Promise.resolve().then(() => order.push(3)));

        await vi.waitFor(() => expect(order).toEqual([1, 2, 3]));
    });
});
