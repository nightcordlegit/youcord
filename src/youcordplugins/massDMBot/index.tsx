/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { React, useEffect, useRef, useState } from "@webpack/common";

const API_BASE = "https://discord.com/api/v9";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function botFetch(token: string, path: string, options?: RequestInit) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

async function fetchGuildMembers(token: string, guildId: string) {
    const members: any[] = [];
    let after = "0";
    while (true) {
        const batch = await botFetch(token, `/guilds/${guildId}/members?limit=1000&after=${after}`);
        if (!Array.isArray(batch) || batch.length === 0) break;
        members.push(...batch);
        if (batch.length < 1000) break;
        after = batch[batch.length - 1].user?.id ?? "0";
    }
    return members;
}

const state = {
    running: false,
    finished: false,
    done: 0,
    failed: 0,
    total: 0,
    log: [] as string[],
    aborted: false,
    delayMs: 1000,
    listeners: new Set<() => void>(),
    notify() { this.listeners.forEach(fn => fn()); },
    subscribe(fn: () => void) { this.listeners.add(fn); },
    unsubscribe(fn: () => void) { this.listeners.delete(fn); },
    reset() {
        this.running = false;
        this.finished = false;
        this.done = 0;
        this.failed = 0;
        this.total = 0;
        this.log = [];
        this.aborted = false;
        this.notify();
    },
};

async function startSending(token: string, guildIds: string[], message: string, mention: boolean) {
    if (state.running || !token || guildIds.length === 0 || !message.trim()) return;

    state.reset();
    state.running = true;
    state.notify();

    const processedUsers = new Set<string>();
    for (const guildId of guildIds) {
        if (state.aborted) {
            state.log.push("Stopped.");
            state.notify();
            break;
        }
        state.log.push(`Fetching members for guild ${guildId}...`);
        state.notify();

        let members: any[];
        try {
            members = await fetchGuildMembers(token, guildId);
        } catch (e: any) {
            state.log.push(`Failed to fetch members for ${guildId}: ${e.message}`);
            state.notify();
            continue;
        }

        const filtered = members.filter((m: any) => {
            if (!m.user || m.user.bot) return false;
            if (processedUsers.has(m.user.id)) return false;
            processedUsers.add(m.user.id);
            return true;
        });

        state.total += filtered.length;
        state.notify();

        for (const m of filtered) {
            if (state.aborted) {
                state.log.push("Stopped.");
                state.notify();
                break;
            }

            const name = m.user?.globalName ?? m.user?.username ?? m.user?.id ?? "?";
            try {
                const dm = await botFetch(token, "/users/@me/channels", {
                    method: "POST",
                    body: JSON.stringify({ recipient_id: m.user.id }),
                });
                const content = mention ? `<@${m.user.id}> ${message}` : message;
                await botFetch(token, `/channels/${dm.id}/messages`, {
                    method: "POST",
                    body: JSON.stringify({ content }),
                });
                state.done++;
                state.log.push(`OK ${name}`);
            } catch (e: any) {
                state.failed++;
                state.log.push(`FAIL ${name}: ${e.message.slice(0, 80)}`);
            }
            state.notify();
            if (!state.aborted) await sleep(state.delayMs);
        }
    }

    state.running = false;
    state.finished = true;
    state.notify();
}

function useObservableState() {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        state.subscribe(listener);
        return () => state.unsubscribe(listener);
    }, []);
    return state;
}

function BotIcon(props: any) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" {...props}>
            <path d="M21.928 11.607c-.202-.488-.635-.605-.928-.683V8c0-1.103-.897-2-2-2h-2V4h-2v2h-2V4h-2v2H9V4H7v2H5c-1.103 0-2 .897-2 2v2.924c-.293.078-.726.195-.928.683A2.05 2.05 0 002 12.75v2.5c0 .504.266.968.686 1.26.178.124.452.26.811.387L3 22h2l.026-4h1.948L7 22h2l.066-4h1.868L11 22h2l.066-4h1.868L15 22h2l.026-4h1.948L19 22h2l.503-5.103c.36-.127.633-.263.811-.387.42-.292.686-.756.686-1.26v-2.5a2.05 2.05 0 00-1.072-1.143zM6.5 8.5h3v1h-3v-1zm8 0h3v1h-3v-1zm-2 5.25c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm-5 0c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5z" fill="#5865F2" />
        </svg>
    );
}

function MassDMBotModal({ rootProps }: { rootProps: any }) {
    const s = useObservableState();
    const [tokenInput, setTokenInput] = useState("");
    const [tokens, setTokens] = useState<string[]>(() => {
        try { return JSON.parse(settings.store.botTokens || "[]"); } catch { return []; }
    });
    const [selectedToken, setSelectedToken] = useState(tokens[0] || "");
    const [guilds, setGuilds] = useState<any[]>([]);
    const [selectedGuildIds, setSelectedGuildIds] = useState<Set<string>>(new Set());
    const [loadingGuilds, setLoadingGuilds] = useState(false);
    const [guildError, setGuildError] = useState("");
    const [message, setMessage] = useState("");
    const [mention, setMention] = useState(true);
    const [editingDelay, setEditingDelay] = useState(false);
    const [delayInput, setDelayInput] = useState(String(state.delayMs / 1000));
    const [showExamples, setShowExamples] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [s.log.length]);

    const saveTokens = (newTokens: string[]) => {
        setTokens(newTokens);
        settings.store.botTokens = JSON.stringify(newTokens);
    };

    const addToken = () => {
        const trimmed = tokenInput.trim();
        if (!trimmed) return;
        if (tokens.includes(trimmed)) return;
        const newTokens = [...tokens, trimmed];
        saveTokens(newTokens);
        setSelectedToken(trimmed);
        setTokenInput("");
    };

    const removeToken = (tok: string) => {
        const newTokens = tokens.filter(t => t !== tok);
        saveTokens(newTokens);
        if (selectedToken === tok) setSelectedToken(newTokens[0] || "");
    };

    const importTokensFromFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("#"));
            const existing = new Set(tokens);
            const newTokens = [...tokens];
            for (const line of lines) {
                if (!existing.has(line)) {
                    newTokens.push(line);
                    existing.add(line);
                }
            }
            saveTokens(newTokens);
            if (newTokens.length > 0 && !selectedToken) setSelectedToken(newTokens[0]);
        };
        reader.readAsText(file);
        e.currentTarget.value = "";
    };

    const fetchGuilds = async () => {
        if (!selectedToken) return;
        setLoadingGuilds(true);
        setGuildError("");
        try {
            const gs = await botFetch(selectedToken, "/users/@me/guilds");
            setGuilds(Array.isArray(gs) ? gs : []);
        } catch (e: any) {
            setGuildError(e.message);
            setGuilds([]);
        }
        setLoadingGuilds(false);
    };

    useEffect(() => {
        if (selectedToken) fetchGuilds();
        else setGuilds([]);
    }, [selectedToken]);

    const toggleGuild = (id: string) => {
        const next = new Set(selectedGuildIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedGuildIds(next);
    };

    const insertExample = (text: string) => {
        setMessage(prev => prev ? prev + "\n" + text : text);
    };

    const idle = !s.running && !s.finished;
    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;

    const exampleItems = [
        { label: "Ping l'utilisateur", code: "<@USER_ID>" },
        { label: "Ping un rôle", code: "<@&ROLE_ID>" },
        { label: "Texte en gras", code: "**texte en gras**" },
        { label: "Texte en italique", code: "*texte en italique*" },
        { label: "Souligné", code: "__souligné__" },
        { label: "Lien cliquable", code: "https://exemple.fr" },
        { label: "Code inline", code: "`code`" },
        { label: "Bloc de code", code: "```\ncode block\n```" },
        { label: "Saut de ligne", code: "ligne 1\\nligne 2" },
        { label: "Citation", code: "> citation" },
        { label: "Message avec embed (lien seul)", code: "https://discord.com/channels/..." },
    ];

    return (
        <ModalRoot {...rootProps} className="mdb-modal">
            <ModalHeader>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <BotIcon style={{ marginRight: 10 }} className="mdb-icon-glow" />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 18, color: "var(--text-strong)", fontFamily: "var(--font-display)" }}>Mass DM Bot</span>
                    {s.running && <span className="mdb-badge">Running...</span>}
                    <ModalCloseButton onClick={rootProps.onClose} />
                </div>
            </ModalHeader>

            <ModalContent className="mdb-content">
                {idle && (
                    <>
                        <div className="mdb-section">
                            <div className="mdb-section-title">Bot Tokens</div>
                            {tokens.length > 0 && (
                                <div className="mdb-token-list">
                                    {tokens.map((tok, i) => (
                                        <div
                                            key={i}
                                            className={`mdb-token-item ${selectedToken === tok ? "mdb-token-selected" : ""}`}
                                            onClick={() => { setSelectedToken(tok); setSelectedGuildIds(new Set()); }}
                                        >
                                            <span className="mdb-token-preview">{tok.slice(0, 20)}...</span>
                                            <button className="mdb-token-remove" onClick={e => { e.stopPropagation(); removeToken(tok); }}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mdb-token-add">
                                <input
                                    className="mdb-input"
                                    type="text"
                                    placeholder="Paste bot token here..."
                                    value={tokenInput}
                                    onChange={e => setTokenInput(e.currentTarget.value)}
                                    onKeyDown={e => { if (e.key === "Enter") addToken(); }}
                                />
                                <Button size="min" variant="primary" onClick={addToken} disabled={!tokenInput.trim()}>Add</Button>
                                <Button size="min" variant="secondary" onClick={importTokensFromFile}>Import .txt</Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt"
                                    style={{ display: "none" }}
                                    onChange={handleFileChange}
                                />
                            </div>
                            {tokens.length > 0 && (
                                <div className="mdb-token-counter">
                                    {tokens.length} token{tokens.length > 1 ? "s" : ""} — click to select
                                </div>
                            )}
                        </div>

                        {selectedToken && (
                            <div className="mdb-section">
                                <div className="mdb-section-title">
                                    Guilds
                                    {loadingGuilds && <span className="mdb-loading"> Loading...</span>}
                                </div>
                                {guildError && <div className="mdb-error">{guildError}</div>}
                                {!loadingGuilds && guilds.length === 0 && !guildError && (
                                    <div className="mdb-hint">No guilds found. Make sure the token is valid.</div>
                                )}
                                <div className="mdb-guild-list">
                                    {guilds.map((g: any) => (
                                        <div
                                            key={g.id}
                                            className={`mdb-guild-item ${selectedGuildIds.has(g.id) ? "mdb-guild-selected" : ""}`}
                                            onClick={() => toggleGuild(g.id)}
                                        >
                                            <span className="mdb-guild-icon">
                                                {g.icon
                                                    ? <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32`} />
                                                    : <span className="mdb-guild-noicon">#</span>
                                                }
                                            </span>
                                            <span className="mdb-guild-name">{g.name}</span>
                                            <span className="mdb-guild-check">{selectedGuildIds.has(g.id) ? "✓" : ""}</span>
                                        </div>
                                    ))}
                                </div>
                                {guilds.length > 0 && (
                                    <div className="mdb-guild-counter">
                                        {selectedGuildIds.size} / {guilds.length} guild{guilds.length > 1 ? "s" : ""} selected
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mdb-section">
                            <div className="mdb-section-title">Message</div>
                            <textarea
                                className="mdb-textarea"
                                placeholder={
                                    "Write your DM message here.\n" +
                                    "Examples: Hello! | <@USER_ID> Welcome! | **bold** text\n" +
                                    "Use <@USER_ID> to ping the user (enabled below)"
                                }
                                value={message}
                                onChange={e => setMessage(e.currentTarget.value)}
                                rows={6}
                            />
                            <div
                                className="mdb-examples-toggle"
                                onClick={() => setShowExamples(!showExamples)}
                            >
                                {showExamples ? "▼" : "▶"} Message examples
                            </div>
                            {showExamples && (
                                <div className="mdb-examples-box">
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        {exampleItems.map((item, i) => (
                                            <div key={i}>
                                                <span className="mdb-example-label">{item.label}</span>
                                                <span
                                                    className="mdb-example-code"
                                                    onClick={() => insertExample(item.code)}
                                                    title="Click to insert"
                                                >
                                                    {item.code}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                        Click any example to insert it into your message.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mdb-options">
                            <label className="mdb-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={mention}
                                    onChange={e => setMention(e.currentTarget.checked)}
                                />
                                <span>Mention each user (@mention)</span>
                            </label>
                            <div className="mdb-delay">
                                <span>Delay: </span>
                                {editingDelay ? (
                                    <input
                                        className="mdb-delay-input"
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="60"
                                        value={delayInput}
                                        onChange={e => setDelayInput(e.currentTarget.value)}
                                        onBlur={() => {
                                            const val = Math.max(0.1, Math.min(60, parseFloat(delayInput) || 1));
                                            state.delayMs = Math.round(val * 1000);
                                            setDelayInput(String(val));
                                            setEditingDelay(false);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                            if (e.key === "Escape") { setDelayInput(String(state.delayMs / 1000)); setEditingDelay(false); }
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    <span
                                        className="mdb-delay-value"
                                        onClick={() => { setDelayInput(String(state.delayMs / 1000)); setEditingDelay(true); }}
                                    >
                                        {state.delayMs / 1000}s
                                    </span>
                                )}
                            </div>
                        </div>

                        {selectedGuildIds.size > 0 && message.trim() && (
                            <div className="mdb-summary">
                                Send to {selectedGuildIds.size} guild{selectedGuildIds.size > 1 ? "s" : ""} via {tokens.length} bot{tokens.length > 1 ? "s" : ""}
                            </div>
                        )}
                    </>
                )}

                {(s.running || s.finished) && (
                    <>
                        <div className="mdb-stats">
                            <span className="mdb-stats-count">{s.done} sent / {s.failed} failed / {s.total} total</span>
                            <span className="mdb-stats-pct">{pct}%</span>
                        </div>
                        <div className="mdb-bar-bg">
                            <div className="mdb-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        {s.finished && (
                            <p className="mdb-done">
                                {s.failed === 0 ? `Finished — ${s.done} DMs sent.` : `Finished — ${s.done} sent, ${s.failed} failed.`}
                            </p>
                        )}
                        <div className="mdb-log" ref={logRef}>
                            {s.log.map((line, i) => (
                                <div key={i} className={`mdb-log-line ${line.startsWith("OK") ? "mdb-log-ok" : line.startsWith("FAIL") ? "mdb-log-fail" : ""}`}>{line}</div>
                            ))}
                        </div>
                    </>
                )}
            </ModalContent>

            <ModalFooter>
                {idle && (
                    <>
                        <Button variant="secondary" onClick={rootProps.onClose}>Cancel</Button>
                        <Button
                            variant="positive"
                            onClick={() => startSending(selectedToken, [...selectedGuildIds], message, mention)}
                            disabled={!selectedToken || selectedGuildIds.size === 0 || !message.trim()}
                        >
                            Start
                        </Button>
                    </>
                )}
                {s.running && (
                    <>
                        <Button variant="secondary" onClick={rootProps.onClose}>Close (background)</Button>
                        <Button variant="dangerPrimary" onClick={() => { state.aborted = true; }}>Stop</Button>
                    </>
                )}
                {s.finished && (
                    <>
                        <Button variant="secondary" onClick={() => state.reset()}>Restart</Button>
                        <Button variant="positive" onClick={rootProps.onClose}>Close</Button>
                    </>
                )}
            </ModalFooter>
        </ModalRoot>
    );
}

const settings = definePluginSettings({
    botTokens: {
        type: OptionType.STRING,
        description: "Bot tokens (JSON array, e.g. [\"token1\",\"token2\"])",
        default: "[]",
    },
});

export default definePlugin({
    name: "MassDMBot",
    enabledByDefault: true,
    description: "Send DMs to guild members using bot tokens.",
    authors: [{ name: "YouCord", id: 0n }],
    settings,

    headerBarButton: {
        icon: BotIcon,
        render: () => (
            <HeaderBarButton
                icon={BotIcon}
                tooltip="Mass DM Bot"
                onClick={() => openModal(props => <MassDMBotModal rootProps={props} />)}
            />
        ),
    },

    start() { },
    stop() { state.aborted = true; },
});
