/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export interface Debounced<T extends Function> {
    (...args: any[]): void;
    /**
     * If a call is pending, run it immediately (synchronously invokes `func`
     * with the most recent pending args) and cancel the timer.
     * Use this before the app exits/quits so debounced writes (e.g. settings
     * saved to disk) are not silently lost when the process ends before the
     * delay elapses.
     */
    flush(): void;
    /** Cancel any pending call without running it. */
    cancel(): void;
}

/**
 * Returns a new function that will call the wrapped function
 * after the specified delay. If the function is called again
 * within the delay, the timer will be reset.
 *
 * The returned function also exposes `.flush()` (run the pending call now)
 * and `.cancel()` (drop the pending call) — see {@link Debounced}.
 * @param func The function to wrap
 * @param delay The delay in milliseconds
 */
export function debounce<T extends Function>(func: T, delay = 300): T & Debounced<T> {
    let timeout: NodeJS.Timeout | undefined;
    let pendingArgs: any[] | null = null;

    const debounced = function (...args: any[]) {
        pendingArgs = args;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = undefined;
            const argsToUse = pendingArgs ?? [];
            pendingArgs = null;
            func(...argsToUse);
        }, delay);
    } as any;

    debounced.flush = () => {
        if (timeout === undefined) return;
        clearTimeout(timeout);
        timeout = undefined;
        const argsToUse = pendingArgs ?? [];
        pendingArgs = null;
        func(...argsToUse);
    };

    debounced.cancel = () => {
        clearTimeout(timeout);
        timeout = undefined;
        pendingArgs = null;
    };

    return debounced;
}
