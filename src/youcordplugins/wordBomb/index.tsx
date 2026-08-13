/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { React, showToast, Toasts, useEffect, useMemo, useRef, useState } from "@webpack/common";

const DICTIONARY_URL = "https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const POSITION_KEY = "YouCord_WordBomb_position";
const FALLBACK_WORDS = [
    "abricot", "admirable", "aventure", "bibliotheque", "cascade", "chocolat", "citrouille",
    "courageux", "decouverte", "dinosaure", "elegance", "fabuleux", "fenetre", "girafe",
    "harmonie", "hippopotame", "imaginaire", "jardinage", "kangourou", "labyrinthe", "libellule",
    "montagne", "mystere", "navigateur", "ordinateur", "papillon", "parapluie", "questionnaire",
    "renard", "restaurant", "salamandre", "tempete", "tranquille", "univers", "valise", "xylophone"
];

interface DictionaryEntry {
    normalized: string;
    word: string;
}

interface Suggestion extends DictionaryEntry {
    newLetters: number;
    score: number;
}

let dictionaryCache: DictionaryEntry[] | null = null;
let dictionaryRequest: Promise<DictionaryEntry[]> | null = null;

function normalizeWord(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

function prepareDictionary(words: unknown): DictionaryEntry[] {
    if (!Array.isArray(words)) return [];

    const seen = new Set<string>();
    const entries: DictionaryEntry[] = [];
    for (const value of words) {
        if (typeof value !== "string" || value.length < 3 || value.length > 28) continue;
        const word = value.toLowerCase().trim();
        const normalized = normalizeWord(word);
        if (normalized.length < 3 || seen.has(normalized)) continue;
        seen.add(normalized);
        entries.push({ word, normalized });
    }
    return entries;
}

async function loadDictionary() {
    if (dictionaryCache) return dictionaryCache;
    if (dictionaryRequest) return dictionaryRequest;

    dictionaryRequest = (async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10_000);
        try {
            const response = await fetch(DICTIONARY_URL, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const entries = prepareDictionary(await response.json());
            if (entries.length < 1_000) throw new Error("Dictionnaire incomplet");
            dictionaryCache = entries;
        } catch {
            dictionaryCache = prepareDictionary(FALLBACK_WORDS);
        } finally {
            window.clearTimeout(timeout);
        }
        return dictionaryCache;
    })();

    return dictionaryRequest;
}

function TrophyIcon({ height = 20, width = 20, className }: { height?: number | string; width?: number | string; className?: string; }) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M18 3V2H6v1H3v4a5 5 0 0 0 4.1 4.92A6.02 6.02 0 0 0 11 15.91V19H8v3h8v-3h-3v-3.09a6.02 6.02 0 0 0 3.9-3.99A5 5 0 0 0 21 7V3h-3ZM5 7V5h1v4.82A3 3 0 0 1 5 7Zm14 0a3 3 0 0 1-1 2.82V5h1v2Z" />
        </svg>
    );
}

function WordBombModal({ rootProps }: { rootProps: any; }) {
    const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
    const [query, setQuery] = useState("");
    const [remainingLetters, setRemainingLetters] = useState(ALPHABET);
    const [lengthMode, setLengthMode] = useState<"balanced" | "short" | "long">("balanced");
    const [loading, setLoading] = useState(true);
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [position, setPosition] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
            if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved as { x: number; y: number; };
        } catch { }
        return { x: Math.max(8, (window.innerWidth - 444) / 2), y: Math.max(8, (window.innerHeight - 310) / 2) };
    });
    const modalRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; } | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadDictionary().then(entries => {
            if (cancelled) return;
            setDictionary(entries);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedQuery(normalizeWord(query)), 120);
        return () => window.clearTimeout(timeout);
    }, [query]);

    const clampPosition = (x: number, y: number) => {
        const bounds = modalRef.current?.getBoundingClientRect();
        const width = bounds?.width ?? 444;
        const height = bounds?.height ?? 310;
        return {
            x: Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - width - 8)),
            y: Math.min(Math.max(y, 8), Math.max(8, window.innerHeight - height - 8))
        };
    };

    useEffect(() => {
        const keepOnScreen = () => setPosition(current => clampPosition(current.x, current.y));
        keepOnScreen();
        window.addEventListener("resize", keepOnScreen);
        return () => window.removeEventListener("resize", keepOnScreen);
    }, []);

    const suggestions = useMemo(() => {
        if (debouncedQuery.length < 2) return [];
        const candidates: Suggestion[] = [];

        for (const entry of dictionary) {
            if (!entry.normalized.includes(debouncedQuery)) continue;
            if (lengthMode === "short" && entry.normalized.length > 8) continue;
            if (lengthMode === "long" && entry.normalized.length < 10) continue;

            const letters = new Set(entry.normalized);
            let newLetters = 0;
            for (const letter of remainingLetters) {
                if (letters.has(letter)) newLetters++;
            }

            const idealLength = lengthMode === "short" ? 6 : lengthMode === "long" ? 15 : 10;
            const score = newLetters * 100 - Math.abs(entry.normalized.length - idealLength);
            candidates.push({ ...entry, newLetters, score });
        }

        return candidates
            .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, "fr"))
            .slice(0, 60);
    }, [debouncedQuery, dictionary, lengthMode, remainingLetters]);

    const chooseWord = (suggestion: Suggestion) => {
        insertTextIntoChatInputBox(suggestion.word);
        const usedLetters = new Set(suggestion.normalized);
        const nextLetters = [...remainingLetters].filter(letter => !usedLetters.has(letter)).join("");
        setRemainingLetters(nextLetters || ALPHABET);
        setQuery("");
        showToast(`« ${suggestion.word} » ajouté dans la zone de saisie.`, Toasts.Type.SUCCESS);
    };

    const startDragging = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
        dragState.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const dragWindow = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragState.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const wantedX = drag.originX + event.clientX - drag.startX;
        const wantedY = drag.originY + event.clientY - drag.startY;
        setPosition(clampPosition(wantedX, wantedY));
    };

    const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragState.current?.pointerId !== event.pointerId) return;
        dragState.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { }
    };

    return (
        <ModalRoot
            {...rootProps}
            className="yc-wb-modal"
            size={ModalSize.MEDIUM}
            style={{ "--yc-wb-left": `${position.x}px`, "--yc-wb-top": `${position.y}px` } as React.CSSProperties}
        >
            <div
                ref={element => { modalRef.current = element?.closest(".yc-wb-modal") as HTMLDivElement | null; }}
                className="yc-wb-header"
                onPointerDown={startDragging}
                onPointerMove={dragWindow}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
            >
                <ModalHeader separator={false}>
                <div className="yc-wb-heading">
                    <span className="yc-wb-heading-icon"><TrophyIcon width={24} height={24} /></span>
                    <div>
                        <h2>WordBomb</h2>
                        <div className="yc-wb-subtitle">Assistant de mots local — aucun envoi automatique</div>
                    </div>
                </div>
                <ModalCloseButton onClick={rootProps.onClose} />
                </ModalHeader>
            </div>

            <ModalContent className="yc-wb-content">
                <section className="yc-wb-panel">
                    <div className="yc-wb-panel-topline">
                        <span>Lettres restantes</span>
                        <button className="yc-wb-link-button" onClick={() => setRemainingLetters(ALPHABET)}>Réinitialiser</button>
                    </div>
                    <div className="yc-wb-alphabet">
                        {[...ALPHABET].map(letter => (
                            <span key={letter} className={remainingLetters.includes(letter) ? "" : "yc-wb-used"}>{letter}</span>
                        ))}
                    </div>
                </section>

                <div className="yc-wb-controls">
                    <input
                        autoFocus
                        className="yc-wb-input"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Entre une syllabe (ex. tra, ion, que)…"
                        aria-label="Syllabe recherchée"
                    />
                    <select className="yc-wb-select" value={lengthMode} onChange={event => setLengthMode(event.target.value as typeof lengthMode)}>
                        <option value="balanced">Équilibré</option>
                        <option value="short">Mots courts</option>
                        <option value="long">Mots longs</option>
                    </select>
                </div>

                <div className="yc-wb-status">
                    {loading
                        ? "Chargement du dictionnaire français…"
                        : debouncedQuery.length < 2
                            ? `${dictionary.length.toLocaleString("fr-FR")} mots disponibles — saisis au moins deux lettres.`
                            : `${suggestions.length} meilleure${suggestions.length > 1 ? "s" : ""} suggestion${suggestions.length > 1 ? "s" : ""}`}
                </div>

                <div className="yc-wb-results">
                    {!loading && debouncedQuery.length >= 2 && suggestions.length === 0 && (
                        <div className="yc-wb-empty">Aucun mot trouvé pour cette syllabe.</div>
                    )}
                    {suggestions.map(suggestion => (
                        <button key={suggestion.word} className="yc-wb-word" onClick={() => chooseWord(suggestion)}>
                            <span>{suggestion.word}</span>
                            <small>{suggestion.normalized.length} lettres · +{suggestion.newLetters} nouvelles</small>
                        </button>
                    ))}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function WordBombButton() {
    return (
        <HeaderBarButton
            icon={TrophyIcon}
            tooltip="Ouvrir WordBomb"
            onClick={() => openModal(rootProps => <WordBombModal rootProps={rootProps} />)}
        />
    );
}

export default definePlugin({
    name: "WordBomb",
    description: "Trouve des mots français contenant une syllabe, sans frappe ni envoi automatique.",
    authors: [{ name: "YouCord", id: 0n }],
    enabledByDefault: true,
    dependencies: ["HeaderBarAPI"],

    headerBarButton: {
        icon: TrophyIcon,
        render: () => null
    },

    start() {
        addHeaderBarButton("youcord-wordbomb", () => <WordBombButton />, 8);
    },

    stop() {
        removeHeaderBarButton("youcord-wordbomb");
    }
});
