/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RenderSongInfo } from "@song-spotlight/api/handlers";
import { Song } from "@song-spotlight/api/structs";
import { sid } from "@song-spotlight/api/util";
import { PluginNative } from "@utils/types";
import { useEffect, useState } from "@webpack/common";

export function useRender(song: Song) {
    const [failed, setFailed] = useState(false);
    const [render, setRender] = useState<RenderSongInfo | null>(null);
    const songId = sid(song);

    useEffect(() => {
        setFailed(false);
        setRender(null);
        Native.renderSong(song)
            .catch(() => null)
            .then(info => info ? setRender(info) : setFailed(true));
    }, [songId, song]);

    return { failed, render };
}

export const Native = VencordNative.pluginHelpers.SongSpotlight as PluginNative<typeof import("./native")>;
