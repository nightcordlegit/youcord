/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Environment detection ────────────────────────────────────────────────────

const IS_ELECTRON = typeof process !== "undefined" && process.versions?.electron;

let _electronNet: typeof import("electron")["net"] | null = null;
let _BrowserWindow: typeof import("electron")["BrowserWindow"] | null = null;
let _electronSession: any = null;
let _youtubeAccountWindow: Electron.BrowserWindow | null = null;

const YOUTUBE_PARTITION = "persist:youcord-youtube";
const CHROME_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

if (IS_ELECTRON) {
    try {
        const electron = require("electron");
        _electronNet = electron.net;
        _BrowserWindow = electron.BrowserWindow;
        _electronSession = electron.session;
    } catch { }
}

// ─── Unified fetch ────────────────────────────────────────────────────────

async function netGet(url: string): Promise<string> {
    const headers = {
        "User-Agent": CHROME_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    };
    if (_electronSession) {
        const youtubeSession = _electronSession.fromPartition(YOUTUBE_PARTITION);
        youtubeSession.setUserAgent(CHROME_USER_AGENT);
        const resp = await youtubeSession.fetch(url, { credentials: "include", headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.text();
    }
    if (_electronNet) {
        const resp = await _electronNet.fetch(url, { headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.text();
    }
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
}

function isAllowedYoutubeAccountUrl(rawUrl: string): boolean {
    try {
        const { hostname, protocol } = new URL(rawUrl);
        if (protocol !== "https:") return false;
        return hostname === "youtube.com" || hostname.endsWith(".youtube.com")
            || hostname === "google.com" || hostname.endsWith(".google.com")
            || hostname === "googleusercontent.com" || hostname.endsWith(".googleusercontent.com")
            || hostname === "gstatic.com" || hostname.endsWith(".gstatic.com");
    } catch {
        return false;
    }
}

export async function getYouTubeAccountStatus(): Promise<string> {
    if (!IS_ELECTRON || !_electronSession) return JSON.stringify({ connected: false, supported: false });
    const youtubeSession = _electronSession.fromPartition(YOUTUBE_PARTITION);
    const [youtubeCookies, googleCookies] = await Promise.all([
        youtubeSession.cookies.get({ domain: ".youtube.com" }),
        youtubeSession.cookies.get({ domain: ".google.com" }),
    ]);
    const accountCookieNames = new Set(["SAPISID", "APISID", "SID", "LOGIN_INFO", "__Secure-1PAPISID", "__Secure-3PAPISID"]);
    const connected = [...youtubeCookies, ...googleCookies].some(cookie => accountCookieNames.has(cookie.name));
    return JSON.stringify({ connected, supported: true });
}

export async function openYouTubeAccountLogin(): Promise<void> {
    if (!IS_ELECTRON || !_BrowserWindow || !_electronSession) throw new Error("YouTube account login requires the desktop app");
    if (_youtubeAccountWindow && !_youtubeAccountWindow.isDestroyed()) {
        _youtubeAccountWindow.show();
        _youtubeAccountWindow.focus();
        return;
    }

    const youtubeSession = _electronSession.fromPartition(YOUTUBE_PARTITION);
    youtubeSession.setUserAgent(CHROME_USER_AGENT);
    _youtubeAccountWindow = new _BrowserWindow({
        width: 1080,
        height: 760,
        minWidth: 720,
        minHeight: 560,
        title: "YouTube — compte local YouCord",
        autoHideMenuBar: true,
        backgroundColor: "#0f0f0f",
        webPreferences: {
            partition: YOUTUBE_PARTITION,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: false,
        },
    });

    const accountWindow = _youtubeAccountWindow;
    accountWindow.webContents.setUserAgent(CHROME_USER_AGENT);
    accountWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedYoutubeAccountUrl(url)) void accountWindow.loadURL(url, { userAgent: CHROME_USER_AGENT });
        return { action: "deny" };
    });
    accountWindow.webContents.on("will-navigate", (event, url) => {
        if (!isAllowedYoutubeAccountUrl(url)) event.preventDefault();
    });
    accountWindow.on("closed", () => { _youtubeAccountWindow = null; });
    await accountWindow.loadURL("https://www.youtube.com/account", { userAgent: CHROME_USER_AGENT });
}

export async function disconnectYouTubeAccount(): Promise<void> {
    if (!IS_ELECTRON || !_electronSession) return;
    if (_youtubeAccountWindow && !_youtubeAccountWindow.isDestroyed()) _youtubeAccountWindow.close();
    const youtubeSession = _electronSession.fromPartition(YOUTUBE_PARTITION);
    await youtubeSession.clearStorageData();
    await youtubeSession.clearCache();
}

const WATCH_URL_PREFIX = "https://youcord.fr/watch?";
let _ytListenerInstalled = false;

export async function installWatchingTogetherIntercept(_?: any) {
    // Electron only: ad blocking via session.webRequest
    if (IS_ELECTRON && _electronSession) {
        try {
            const adPatterns = [
                "*://*.doubleclick.net/*",
                "*://*.googlevideo.com/*oad=*",
                "*://*.googlevideo.com/*adformat=*",
                "*://*.youtube.com/pagead/*",
                "*://*.youtube.com/api/stats/ads*",
                "*://*.youtube.com/ptracking*",
                "*://*.youtube-nocookie.com/pagead/*",
                "*://*.youtube-nocookie.com/api/stats/ads*",
            ];
            _electronSession.defaultSession.webRequest.onBeforeRequest({ urls: adPatterns }, (_d: any, cb: any) => cb({ cancel: true }));
            _electronSession.defaultSession.webRequest.onBeforeSendHeaders({
                urls: [
                    "*://*.youtube.com/youtubei/v1/player*",
                    "*://*.youtube-nocookie.com/youtubei/v1/player*"
                ]
            }, (details: any, cb: any) => {
                const headers = { ...details.requestHeaders };
                headers.Referer = "https://www.youtube.com/";
                headers.Origin = "https://www.youtube.com";
                cb({ requestHeaders: headers });
            });
        } catch (e) { console.error("YTD adblocker error:", e); }
    }

    if (_ytListenerInstalled) return;
    _ytListenerInstalled = true;

    if (IS_ELECTRON && _BrowserWindow) {
        // Electron mode: hook BrowserWindow navigation
        const electron = require("electron") as typeof import("electron");
        const hook = (win: Electron.BrowserWindow) => {
            win.webContents.on("will-navigate" as any, (event: any, url: string) => {
                if (!url.startsWith(WATCH_URL_PREFIX)) return;
                event.preventDefault();
                try {
                    const ytId = new URL(url).searchParams.get("v") ?? "";
                    _BrowserWindow!.getAllWindows().forEach(w => {
                        try {
                            w.webContents.executeJavaScript(
                                `window.dispatchEvent(new CustomEvent('youtube-watch-together', { detail: { ytId: ${JSON.stringify(ytId)} } }))`
                            ).catch(() => {});
                        } catch { }
                    });
                } catch { }
            });
            win.webContents.on("new-window" as any, (event: any, url: string) => {
                if (!url.startsWith(WATCH_URL_PREFIX)) return;
                event.preventDefault();
                try {
                    const ytId = new URL(url).searchParams.get("v") ?? "";
                    _BrowserWindow!.getAllWindows().forEach(w => {
                        try {
                            w.webContents.executeJavaScript(
                                `window.dispatchEvent(new CustomEvent('youtube-watch-together', { detail: { ytId: ${JSON.stringify(ytId)} } }))`
                            ).catch(() => {});
                        } catch { }
                    });
                } catch { }
            });
        };
        _BrowserWindow.getAllWindows().forEach(hook);
        electron.app.on("browser-window-created" as any, (_e: any, win: Electron.BrowserWindow) => hook(win));
    } else {
        // Browser extension mode: intercept anchor clicks
        const _ytClickHandler = (e: MouseEvent) => {
            const target = (e.target as HTMLElement)?.closest("a") as HTMLAnchorElement | null;
            if (!target) return;
            const href = target.href || "";
            if (!href.startsWith(WATCH_URL_PREFIX)) return;
            e.preventDefault();
            e.stopPropagation();
            try {
                const ytId = new URL(href).searchParams.get("v") ?? "";
                window.dispatchEvent(new CustomEvent("youtube-watch-together", { detail: { ytId } }));
            } catch { }
        };
        document.addEventListener("click", _ytClickHandler, true);
        (window as any).__ytClickHandler = _ytClickHandler;
    }
}

export function uninstallYtIntercept(): void {
    const handler = (window as any).__ytClickHandler;
    if (handler && document) {
        document.removeEventListener("click", handler, true);
        delete (window as any).__ytClickHandler;
    }
}

export async function searchYouTube(_: any, query: string): Promise<string> {
    if (!query?.trim()) return JSON.stringify({ videos: [], channels: [] });
    const html = await netGet(`https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`);

    const startIdx = html.indexOf("var ytInitialData = ");
    if (startIdx === -1) throw new Error("Could not find ytInitialData");
    const jsonStart = startIdx + "var ytInitialData = ".length;
    const scriptEnd = html.indexOf("</script>", jsonStart);
    const rawStr = scriptEnd > -1 ? html.slice(jsonStart, scriptEnd).replace(/;\s*$/, "") : html.slice(jsonStart, jsonStart + 800000);
    const json = JSON.parse(rawStr);
    const contents =
        json.contents
            ?.twoColumnSearchResultsRenderer
            ?.primaryContents
            ?.sectionListRenderer
            ?.contents?.[0]
            ?.itemSectionRenderer
            ?.contents ?? [];

    const channels = contents
        .filter((c: any) => c.channelRenderer)
        .slice(0, 4)
        .map((c: any) => {
            const ch = c.channelRenderer;
            const thumbs: any[] = ch.thumbnail?.thumbnails ?? [];
            const thumb = thumbs[thumbs.length - 1]?.url?.replace(/^\/\//, "https://") ?? "";
            const subs = ch.subscriberCountText?.simpleText ?? ch.videoCountText?.runs?.map((r:any) => r.text).join("") ?? "";
            return {
                channelId: ch.channelId ?? "",
                title: ch.title?.simpleText ?? "Unknown Channel",
                handle: ch.subscriberCountText?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? ch.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? ch.customUrl ?? "",
                subscriberCount: subs,
                artworkUrl: thumb,
                isChannel: true,
            };
        });

    const videos = contents
        .filter((c: any) => c.videoRenderer)
        .slice(0, 50)
        .map((c: any) => {
            const v = c.videoRenderer;
            const thumbs: any[] = v.thumbnail?.thumbnails ?? [];
            const thumb = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? "";
            const viewCount = v.shortViewCountText?.simpleText
                ?? v.shortViewCountText?.runs?.map((r: any) => r.text).join("")
                ?? v.viewCountText?.simpleText
                ?? "";
            return {
                id: v.videoId ?? "",
                title: v.title?.runs?.[0]?.text ?? "Unknown Title",
                author: v.ownerText?.runs?.[0]?.text ?? "Unknown Author",
                artworkUrl: thumb,
                durationStr: v.lengthText?.simpleText ?? "Live",
                viewCount,
            };
        });

    return JSON.stringify({ videos, channels });
}

export async function resolveVideoDetails(_: any, videoId: string): Promise<string> {
    if (!videoId) throw new Error("No video ID");
    const html = await netGet(`https://www.youtube.com/watch?v=${videoId}`);
    const match = html.match(/var ytInitialPlayerResponse = (\{.*?\});<\/script>/);
    if (!match) throw new Error("Could not find ytInitialPlayerResponse");
    const json = JSON.parse(match[1]);
    const d = json.videoDetails;
    if (!d) throw new Error("No videoDetails");
    const thumbs: any[] = d.thumbnail?.thumbnails ?? [];
    const thumb = thumbs[thumbs.length - 1]?.url ?? "";
    const secs = Number(d.lengthSeconds ?? 0);
    return JSON.stringify({
        id: d.videoId, title: d.title, author: d.author, artworkUrl: thumb,
        durationStr: secs > 0 ? `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}` : "Live",
        viewCount: "",
    });
}

export async function searchChannelVideos(_: any, handleOrId: string): Promise<string> {
    let url = `https://www.youtube.com/channel/${handleOrId}/videos`;
    if (handleOrId.startsWith("@") || handleOrId.startsWith("/")) {
        const h = handleOrId.startsWith("/") ? handleOrId : `/${handleOrId}`;
        url = `https://www.youtube.com${h}/videos`;
    }
    const html = await netGet(url);
    let json: any = null;
    try {
        const startIdx = html.indexOf("var ytInitialData = ");
        if (startIdx === -1) return JSON.stringify({ videos: [], channels: [], channelInfo: null });
        const jsonStart = startIdx + "var ytInitialData = ".length;
        const scriptEnd = html.indexOf("</script>", jsonStart);
        const rawStr = scriptEnd > -1 ? html.slice(jsonStart, scriptEnd).replace(/;\s*$/, "") : html.slice(jsonStart, jsonStart + 500000);
        json = JSON.parse(rawStr);
    } catch {
        return JSON.stringify({ videos: [], channels: [], channelInfo: null });
    }
    try {
        let channelInfo: any = null;
        if (json.header?.pageHeaderRenderer) {
            const h = json.header.pageHeaderRenderer.content?.pageHeaderViewModel;
            const banner = h?.banner?.imageBannerViewModel?.image?.sources;
            const avatar = h?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;

            channelInfo = {
                title: h?.title?.dynamicTextViewModel?.text?.content,
                bio: h?.description?.descriptionPreviewViewModel?.description?.content,
                bannerUrl: banner ? banner[banner.length - 1].url : null,
                avatarUrl: avatar ? avatar[avatar.length - 1].url : null,
                subscribers: h?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[0]?.text?.content,
                videoCount: h?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[1]?.text?.content
            };
        } else if (json.header?.c4TabbedHeaderRenderer) {
            const h = json.header.c4TabbedHeaderRenderer;
            const banner = h.banner?.thumbnails;
            const avatar = h.avatar?.thumbnails;

            channelInfo = {
                title: h.title,
                bio: json.metadata?.channelMetadataRenderer?.description,
                bannerUrl: banner ? banner[banner.length - 1].url : null,
                avatarUrl: avatar ? avatar[avatar.length - 1].url : null,
                subscribers: h.subscriberCountText?.simpleText,
                videoCount: null
            };
        }

        const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
        let videos: any[] = [];
        for (const tab of tabs) {
            const items = tab.tabRenderer?.content?.richGridRenderer?.contents ?? [];
            let vids = items
                .filter((i: any) => i.richItemRenderer?.content)
                .map((i: any) => {
                    const { content } = i.richItemRenderer;

                    if (content.lockupViewModel) {
                        const lvm = content.lockupViewModel;
                        const thumbs: any[] = lvm.contentImage?.thumbnailViewModel?.image?.sources ?? [];
                        const thumb = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? "";
                        const overlays: any[] = lvm.contentImage?.thumbnailViewModel?.overlays ?? [];
                        let durationStr = "Live";
                        for (const o of overlays) {
                            const text = o.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
                            if (text) { durationStr = text; break; }
                        }
                        const metaRows = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
                        const viewCount = metaRows[0]?.metadataParts?.[0]?.text?.content ?? "";
                        return {
                            id: lvm.contentId ?? "",
                            title: lvm.metadata?.lockupMetadataViewModel?.title?.content ?? "Unknown",
                            author: "",
                            artworkUrl: thumb,
                            durationStr,
                            viewCount,
                        };
                    }

                    if (content.videoRenderer) {
                        const v = content.videoRenderer;
                        const thumbs: any[] = v.thumbnail?.thumbnails ?? [];
                        const thumb = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? "";
                        const viewCount = v.shortViewCountText?.simpleText ?? v.shortViewCountText?.runs?.map((r: any) => r.text).join("") ?? "";
                        return { id: v.videoId ?? "", title: v.title?.runs?.[0]?.text ?? "Unknown", author: v.ownerText?.runs?.[0]?.text ?? "", artworkUrl: thumb, durationStr: v.lengthText?.simpleText ?? "Live", viewCount };
                    }

                    return null;
                })
                .filter(Boolean);

            if (vids.length === 0) {
                const sections = tab.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
                for (const sec of sections) {
                    const shelf = sec.itemSectionRenderer?.contents?.[0]?.shelfRenderer;
                    const rows = shelf?.content?.horizontalListRenderer?.items ?? shelf?.content?.expandedShelfContentsRenderer?.items ?? [];
                    vids = rows
                        .filter((i: any) => i.videoRenderer)
                        .map((i: any) => {
                            const v = i.videoRenderer;
                            const thumbs: any[] = v.thumbnail?.thumbnails ?? [];
                            const thumb = thumbs[thumbs.length - 1]?.url ?? "";
                            const viewCount = v.shortViewCountText?.simpleText ?? "";
                            return { id: v.videoId ?? "", title: v.title?.runs?.[0]?.text ?? "Unknown", author: v.ownerText?.runs?.[0]?.text ?? "", artworkUrl: thumb, durationStr: v.lengthText?.simpleText ?? "Live", viewCount };
                        });
                    if (vids.length > 0) break;
                }
            }

            if (vids.length > 0) { videos = vids.slice(0, 50); break; }
        }
        return JSON.stringify({ videos, channels: [], channelInfo });
    } catch { return JSON.stringify({ videos: [], channels: [], channelInfo: null }); }
}
