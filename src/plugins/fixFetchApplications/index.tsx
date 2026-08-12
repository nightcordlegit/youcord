/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

/*
 * Discord build 21552 ships a broken legacy applications-fetching path:
 *  - fetchApplications() rethrows HTTP errors, which crashes components that
 *    render app data (app embeds in the message list, activity shelf, etc.),
 *    causing conversations to fail to load messages.
 *  - The HTTP request builder calls l.query() on a request object that lacks
 *    the method in this build, producing `l.query is not a function`.
 *
 * Fixes:
 *  1. Make the applications stores record the failure instead of throwing,
 *     so message rendering never crashes.
 *  2. Guard the .query() call so requests degrade gracefully.
 */
export default definePlugin({
    name: "FixApplicationsFetch",
    description: "Fixes Discord's broken applications fetching (crash 'l.query is not a function') that blocks message loading in conversations",
    tags: ["Bugfix"],
    authors: [Devs.Ven],
    required: true,

    patches: [
        {
            // fetchApplications (plural): swallow HTTP errors instead of rethrowing
            find: "APPLICATIONS_FETCH_FAIL",
            replacement: {
                match: /catch\((\i)\)\{throw 429!==\i\.status&&(\i\.h\.dispatch\(\{type:"APPLICATIONS_FETCH_FAIL"(?:,[^}]*?)\}),\i\}\)/,
                replace: "catch($1){$2}",
            },
        },
        {
            // fetchApplication (singular): same treatment
            find: "APPLICATION_FETCH_FAIL",
            replacement: {
                match: /catch\((\i)\)\{throw (\i\.h\.dispatch\(\{type:"APPLICATION_FETCH_FAIL"(?:,[^}]*?)\}),\i\}\)/,
                replace: "catch($1){$2}",
            },
        },
        {
            // HTTP request builder: don't crash when the request object lacks .query
            find: "X-Context-Properties",
            replacement: {
                match: /l\.query\(e\)/,
                replace: "\"function\"==typeof l.query&&l.query(e)",
            },
        },
    ],
});
