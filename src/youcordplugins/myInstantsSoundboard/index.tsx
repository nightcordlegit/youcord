/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { DataStore } from "@api/index";
import { UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { PluginNative } from "@utils/types";
import { Button, Forms, React, Toasts, useEffect, useRef, useState } from "@webpack/common";

import type { MyInstantResult } from "./native";

const Native = VencordNative.pluginHelpers.MyInstantsSoundboard as PluginNative<typeof import("./native")>;
const STORE_KEY = "MyInstantsSoundboard_state";
const CATEGORIES = ["sound effects", "memes", "games", "reactions", "viral", "anime & manga", "movies", "television"];
const EMPTY_STATE = { favorites: [] as MyInstantResult[], recent: [] as MyInstantResult[], volume: 70, outputDeviceId: "default" };

let activeAudio: HTMLAudioElement | null = null;

function stopAudio() {
    activeAudio?.pause();
    activeAudio = null;
}

function SoundboardIcon({ className = "" }: { className?: string; }) {
    return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 1h3V6h-3v2Zm-4 4h7v-2h-7v2Zm0 4h7v-2h-7v2Zm-6-7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" /></svg>;
}

function SoundboardModal({ modalProps }: { modalProps: any; }) {
    const [items, setItems] = useState<MyInstantResult[]>([]);
    const [state, setState] = useState(EMPTY_STATE);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("sound effects");
    const [view, setView] = useState<"browse" | "favorites" | "recent">("browse");
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const requestId = useRef(0);

    useEffect(() => {
        DataStore.get<typeof EMPTY_STATE>(STORE_KEY).then(saved => saved && setState({ ...EMPTY_STATE, ...saved }));
        const refreshDevices = () => navigator.mediaDevices?.enumerateDevices().then(devices => setOutputDevices(devices.filter(device => device.kind === "audiooutput"))).catch(() => setOutputDevices([]));
        void refreshDevices();
        navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
        return () => navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
    }, []);
    const persist = (next: typeof EMPTY_STATE) => { setState(next); void DataStore.set(STORE_KEY, next); };

    async function load(search = query, selectedCategory = category) {
        const id = ++requestId.current;
        setLoading(true);
        try {
            const parsed = JSON.parse(await Native.browse(search, selectedCategory, 1)) as MyInstantResult[];
            if (id === requestId.current) setItems(parsed);
        } catch (error: any) {
            Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message: `MyInstants: ${error?.message ?? error}` });
        } finally { if (id === requestId.current) setLoading(false); }
    }

    // `load` intentionally reads the latest request ref; rerun only when the selected feed changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (view === "browse") void load("", category); }, [category, view]);

    async function play(item: MyInstantResult) {
        stopAudio();
        activeAudio = new Audio(item.audioUrl);
        activeAudio.volume = state.volume / 100;
        setPlayingId(item.id);
        activeAudio.addEventListener("ended", () => setPlayingId(null), { once: true });
        try {
            if ("setSinkId" in activeAudio && state.outputDeviceId !== "default") await activeAudio.setSinkId(state.outputDeviceId);
            await activeAudio.play();
        } catch (error: any) {
            setPlayingId(null);
            Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message: `Sortie audio indisponible : ${error?.message ?? error}` });
        }
        persist({ ...state, recent: [item, ...state.recent.filter(x => x.id !== item.id)].slice(0, 30) });
    }

    function toggleFavorite(item: MyInstantResult) {
        const exists = state.favorites.some(x => x.id === item.id);
        persist({ ...state, favorites: exists ? state.favorites.filter(x => x.id !== item.id) : [item, ...state.favorites] });
    }

    const shown = view === "favorites" ? state.favorites : view === "recent" ? state.recent : items;
    return <ModalRoot {...modalProps} size={ModalSize.LARGE}>
        <ModalHeader separator={false} className="yc-mi-header">
            <div className="yc-mi-brand"><span className="yc-mi-brand-icon"><SoundboardIcon /></span><div><Forms.FormTitle tag="h2">MyInstants</Forms.FormTitle><span>Ta soundboard instantanée</span></div></div>
            <ModalCloseButton onClick={modalProps.onClose} />
        </ModalHeader>
        <ModalContent className="yc-mi-modal">
            <div className="yc-mi-toolbar">
                <div className="yc-mi-search-wrap"><span>⌕</span><input className="yc-mi-search" value={query} placeholder="Rechercher vine boom, bruh, anime…" onChange={e => setQuery(e.currentTarget.value)} onKeyDown={e => { if (e.key === "Enter") { setView("browse"); void load(); } }} /></div>
                <Button className="yc-mi-search-btn" size={Button.Sizes.SMALL} onClick={() => { setView("browse"); void load(); }}>Rechercher</Button>
                <Button className="yc-mi-stop-btn" size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => { stopAudio(); setPlayingId(null); }}>■</Button>
            </div>
            <div className="yc-mi-tabs">
                <button className={`yc-mi-tab ${view === "favorites" ? "active" : ""}`} onClick={() => setView("favorites")}>★ <span>Favoris</span></button>
                <button className={`yc-mi-tab ${view === "recent" ? "active" : ""}`} onClick={() => setView("recent")}>↻ <span>Récents</span></button>
                {CATEGORIES.map(cat => <button key={cat} className={`yc-mi-tab ${view === "browse" && category === cat ? "active" : ""}`} onClick={() => { setQuery(""); setView("browse"); setCategory(cat); }}>{cat}</button>)}
            </div>
            <div className="yc-mi-section-title"><div><strong>{view === "favorites" ? "Tes favoris" : view === "recent" ? "Écoutés récemment" : category}</strong><span>{shown.length} sons disponibles</span></div>{playingId && <span className="yc-mi-playing-label"><i /> Lecture en cours</span>}</div>
            <div className="yc-mi-device"><span className="yc-mi-device-icon">◉</span><div><strong>Périphérique de sortie</strong><small>Choisis un câble virtuel pour envoyer le son vers l'entrée micro de Discord</small></div><select value={state.outputDeviceId} onChange={e => persist({ ...state, outputDeviceId: e.currentTarget.value })}><option value="default">Sortie par défaut</option>{outputDevices.filter(device => device.deviceId !== "default").map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Sortie audio ${index + 1}`}</option>)}</select></div>
            <div className="yc-mi-grid">
                {loading && view === "browse" ? <div className="yc-mi-empty">Chargement…</div> : shown.length === 0 ? <div className="yc-mi-empty">Aucun son trouvé.</div> : shown.map(item => <button className="yc-mi-card" key={item.id} onClick={() => play(item)}>
                    <span className={`yc-mi-play ${playingId === item.id ? "playing" : ""}`}>{playingId === item.id ? <><i /><i /><i /></> : "▶"}</span><span className="yc-mi-name">{item.name}</span>
                    <span role="button" tabIndex={0} aria-label="Ajouter aux favoris" className={`yc-mi-fav ${state.favorites.some(x => x.id === item.id) ? "active" : ""}`} onClick={e => { e.stopPropagation(); toggleFavorite(item); }}>★</span>
                </button>)}
            </div>
            <div className="yc-mi-footer"><span className="yc-mi-volume-icon">◖</span><input type="range" min="0" max="100" value={state.volume} style={{ "--yc-volume": `${state.volume}%` } as React.CSSProperties} onChange={e => { const volume = Number(e.currentTarget.value); if (activeAudio) activeAudio.volume = volume / 100; persist({ ...state, volume }); }} /><strong>{state.volume}%</strong><span className="yc-mi-source">Propulsé par <b>MyInstants</b></span></div>
        </ModalContent>
    </ModalRoot>;
}

function SoundboardButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    return <UserAreaButton tooltipText={hideTooltips ? void 0 : "MyInstants Soundboard"} icon={<SoundboardIcon className={iconForeground} />} plated={nameplate != null} onClick={() => openModal(props => <SoundboardModal modalProps={props} />)} />;
}
const renderButton: UserAreaButtonFactory = props => <SoundboardButton {...props} />;

export default definePlugin({
    name: "MyInstantsSoundboard",
    enabledByDefault: true,
    description: "Search, preview and favorite MyInstants sounds from the user panel.",
    authors: [{ name: "YouCord", id: 0n }],
    dependencies: ["UserAreaAPI"],
    userAreaButton: { icon: SoundboardIcon, render: renderButton, priority: -100 },
    stop: stopAudio,
});
