/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import { findComponentByCodeLazy } from "@webpack";
import { Clickable, Popout, Tooltip, useEffect, useMemo, useRef, useState } from "@webpack/common";
import { openYouCordModal } from "@youcordplugins/compactMode/YouCordModal";
import type { ComponentType, JSX, MouseEventHandler, ReactNode } from "react";

const logger = new Logger("HeaderBarAPI");

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '"aria-haspopup":') as ComponentType<ChannelToolbarButtonProps>;

export interface HeaderBarButtonProps {
    icon: ComponentType<any>;
    tooltip: ReactNode;
    onClick?: MouseEventHandler<HTMLDivElement>;
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
    className?: string;
    iconSize?: number;
    position?: "top" | "bottom" | "left" | "right";
    selected?: boolean;
    "aria-label"?: string;
}

export interface ChannelToolbarButtonProps extends HeaderBarButtonProps {
    iconClassName?: string;
    position?: "top" | "bottom" | "left" | "right";
    selected?: boolean;
    disabled?: boolean;
    showBadge?: boolean;
    badgePosition?: "top" | "bottom";
}

export type HeaderBarButtonFactory = () => JSX.Element | null;

export interface HeaderBarButtonData {
    render: HeaderBarButtonFactory;
    icon: ComponentType<any>;
    priority?: number;
    location?: "headerbar" | "channeltoolbar";
}

interface ButtonEntry {
    render: HeaderBarButtonFactory;
    priority: number;
}

export function HeaderBarButton(props: HeaderBarButtonProps & { ref?: React.RefObject<any>; }) {
    const {
        icon: Icon,
        tooltip,
        onClick,
        onContextMenu,
        className,
        iconSize = 18,
        position = "bottom",
        selected,
        ref,
        "aria-label": ariaLabel,
    } = props;

    const label = ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined);

    if (!Tooltip || !Clickable || !Icon) {
        logger.error(`HeaderBarButton missing component for tooltip=${tooltip}: Tooltip=${!!Tooltip}, Clickable=${!!Clickable}, Icon=${!!Icon}`);
    }

    const headerBtnStyle = useMemo(() => ({
        width: iconSize,
        boxSizing: "content-box",
        justifyContent: "center",
        cursor: "pointer",
    }), [iconSize]);

    return (
        <Tooltip text={tooltip ?? ""} position={position} shouldShow={tooltip != null}>
            {({ onMouseEnter, onMouseLeave }) => (
                <Clickable
                    {...{ innerRef: ref } as any}
                    className={classes("youcord-header-btn", className)}
                    style={headerBtnStyle}
                    onClick={onClick}
                    onContextMenu={onContextMenu}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-expanded={selected}
                >
                    <Icon size="custom" width={iconSize} height={iconSize} color="currentColor" />
                </Clickable>
            )}
        </Tooltip>
    );
}

export function ChannelToolbarButton(props: ChannelToolbarButtonProps) {
    return <HeaderBarIcon {...props} />;
}

const headerBarButtons = new Map<string, ButtonEntry>();
const channelToolbarButtons = new Map<string, ButtonEntry>();

const headerBarListeners = new Set<() => void>();
const channelToolbarListeners = new Set<() => void>();

let _headerBarHidden = false;
try { _headerBarHidden = localStorage.getItem("YouCord_hideHeaderPluginButtons") === "1"; } catch { }

export function areHeaderBarButtonsHidden(): boolean {
    return _headerBarHidden;
}

export function toggleHeaderBarButtons() {
    _headerBarHidden = !_headerBarHidden;
    try {
        if (_headerBarHidden) localStorage.setItem("YouCord_hideHeaderPluginButtons", "1");
        else localStorage.removeItem("YouCord_hideHeaderPluginButtons");
    } catch { }
    headerBarListeners.forEach(listener => listener());
    window.dispatchEvent(new Event("youcord-header-buttons-change"));
    return _headerBarHidden;
}

try {
    document.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.code === "KeyB") {
            event.preventDefault();
            event.stopPropagation();
            toggleHeaderBarButtons();
        }
    }, true);
} catch { }

export function addHeaderBarButton(id: string, render: HeaderBarButtonFactory, priority = 0) {
    headerBarButtons.set(id, { render, priority });
    headerBarListeners.forEach(listener => listener());
}

export function removeHeaderBarButton(id: string) {
    headerBarButtons.delete(id);
    headerBarListeners.forEach(listener => listener());
}

export function addChannelToolbarButton(id: string, render: HeaderBarButtonFactory, priority = 0) {
    channelToolbarButtons.set(id, { render, priority });
    channelToolbarListeners.forEach(listener => listener());
}

export function removeChannelToolbarButton(id: string) {
    channelToolbarButtons.delete(id);
    channelToolbarListeners.forEach(listener => listener());
}

// ══════════════════════════════════════════════════════════════════
// STEALTH MODE
// ══════════════════════════════════════════════════════════════════

let _stealthActive = false;
try { _stealthActive = localStorage.getItem("YouCord_stealthMode") === "1"; } catch { }

export function isStealthModeEnabled(): boolean {
    return _stealthActive;
}

function persistStealth(v: boolean) {
    try { v ? localStorage.setItem("YouCord_stealthMode", "1") : localStorage.removeItem("YouCord_stealthMode"); } catch { }
}

const NON_REACT_SELECTORS = [
    "#youcord-titlebar-btn",
    "#youcord-titlebar-link-style",
    ".nai-nav-item",
];

function hideNonReactElements(hide: boolean) {
    let count = 0;
    for (const sel of NON_REACT_SELECTORS) {
        try {
            document.querySelectorAll(sel).forEach(el => {
                (el as HTMLElement).style.display = hide ? "none" : "";
                count++;
            });
        } catch { }
    }
    console.log("[StealthMode] hideNonReact hide=" + hide + " count=" + count);
}

export function syncStealthBodyClass() {
    try { if (_stealthActive) document.body?.classList.add("youcord-stealth"); else document.body?.classList.remove("youcord-stealth"); } catch { }
    hideNonReactElements(_stealthActive);
}

export function toggleStealthMode() {
    _stealthActive = !_stealthActive;
    persistStealth(_stealthActive);
    hideNonReactElements(_stealthActive);
    _notifyStealthChange();
    try { if (_stealthActive) document.body?.classList.add("youcord-stealth"); else document.body?.classList.remove("youcord-stealth"); } catch { }
    console.log("[StealthMode] toggled →", _stealthActive);
    return _stealthActive;
}

if (_stealthActive) {
    try { hideNonReactElements(true); } catch { }
    try { document.body?.classList.add("youcord-stealth"); } catch { }
}

try {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyH") {
            e.preventDefault();
            e.stopPropagation();
            toggleStealthMode();
        }
    }, true);
} catch { }

try {
    let stealthObserver: MutationObserver | null = null;
    const startObserver = () => {
        if (stealthObserver) return;
        stealthObserver = new MutationObserver(() => {
            if (_stealthActive) hideNonReactElements(true);
        });
        const target = document.body || document.documentElement;
        if (target) {
            stealthObserver.observe(target, { childList: true, subtree: true });
        }
    };
    const stopObserver = () => {
        if (stealthObserver) { stealthObserver.disconnect(); stealthObserver = null; }
    };
    if (_stealthActive) {
        if (document.body) startObserver();
        else document.addEventListener("DOMContentLoaded", startObserver);
    }
    window.addEventListener("youcord-stealth-change", () => {
        if (_stealthActive) startObserver();
        else stopObserver();
    });
} catch { }

const stealthListeners = new Set<() => void>();
export function _notifyStealthChange() {
    stealthListeners.forEach(fn => fn());
    window.dispatchEvent(new Event("youcord-stealth-change"));
}
export function addStealthListener(fn: () => void) { stealthListeners.add(fn); }
export function removeStealthListener(fn: () => void) { stealthListeners.delete(fn); }

// ══════════════════════════════════════════════════════════════════
// COMPACT MODE
// ══════════════════════════════════════════════════════════════════

let _compactActive = false;
try { _compactActive = localStorage.getItem("YouCord_compactMode") === "1"; } catch { }

export function isCompactModeEnabled(): boolean {
    return _compactActive;
}

function persistCompact(v: boolean) {
    try { v ? localStorage.setItem("YouCord_compactMode", "1") : localStorage.removeItem("YouCord_compactMode"); } catch { }
}

export function syncCompactBodyClass() {
    try {
        const stored = localStorage.getItem("YouCord_compactMode");
        if (stored === "1" && !_compactActive) {
            _compactActive = true;
        } else if (stored !== "1" && _compactActive) {
            _compactActive = false;
        }
    } catch { }

    try {
        if (_compactActive) {
            document.body?.classList.add("youcord-compact");
        } else {
            document.body?.classList.remove("youcord-compact");
        }
    } catch { }

    _notifyCompactChange();
}

export function toggleCompactMode() {
    _compactActive = !_compactActive;
    persistCompact(_compactActive);
    _notifyCompactChange();
    try { if (_compactActive) document.body?.classList.add("youcord-compact"); else document.body?.classList.remove("youcord-compact"); } catch { }
    console.log("[CompactMode] toggled →", _compactActive);
    return _compactActive;
}

if (_compactActive) {
    try { document.body?.classList.add("youcord-compact"); } catch { }
}

export const compactListeners = new Set<() => void>();
export function _notifyCompactChange() {
    compactListeners.forEach(fn => fn());
    window.dispatchEvent(new Event("youcord-compact-change"));
}
export function addCompactListener(fn: () => void) { compactListeners.add(fn); }
export function removeCompactListener(fn: () => void) { compactListeners.delete(fn); }

// ══════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════

const GridVerticalIcon = (props: any) => (
    <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill={props.color || "currentColor"} {...props}>
        <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
    </svg>
);

const GearIcon = (props: any) => (
    <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill={props.color || "currentColor"} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    </svg>
);

const YouCordBrandIcon = () => (
    <svg width="23" height="23" viewBox="0 0 40 34" aria-hidden="true">
        <defs>
            <linearGradient id="youcord-brand-y" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#ffe45c" />
                <stop offset="1" stopColor="#ffad00" />
            </linearGradient>
            <linearGradient id="youcord-brand-c" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#cb65ff" />
                <stop offset="1" stopColor="#6f24d9" />
            </linearGradient>
        </defs>
        <path d="M3 3h7l5 8 5-8h7l-9 14v9h-7v-9L3 3Z" fill="url(#youcord-brand-y)" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M37 13.5c-2-2.4-5-3.7-8.3-3.7-6.4 0-11.2 4.3-11.2 10.5s4.8 10.4 11.2 10.4c3.4 0 6.5-1.3 8.5-3.9l-4.6-3.3c-.9 1.1-2.1 1.8-3.7 1.8-2.8 0-4.8-2-4.8-5s2-5.1 4.8-5.1c1.5 0 2.8.7 3.7 1.8l4.4-3.5Z" fill="url(#youcord-brand-c)" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
);

function YouCordTitleLink() {
    return (
        <button
            id="youcord-titlebar-btn"
            type="button"
            title="Ouvrir YouCord.fr"
            aria-label="Ouvrir YouCord.fr"
            onClick={() => VencordNative.native.openExternal("https://youcord.fr")}
        >
            <YouCordBrandIcon />
            <span>YouCord</span>
        </button>
    );
}

// ══════════════════════════════════════════════════════════════════
// COMPACT POPOUTS
// ══════════════════════════════════════════════════════════════════

function CompactHeaderPopout({ type, closePopout }: { type: "header" | "channel", closePopout: () => void; }) {
    const map = type === "header" ? headerBarButtons : channelToolbarButtons;
    return (
        <div className="compact-popout-container">
            <div className="compact-popout-grid">
                {Array.from(map)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([id, { render: Button }]) => (
                        <div key={id} style={{ display: "contents" }} onClick={closePopout}>
                            <ErrorBoundary noop>
                                <Button />
                            </ErrorBoundary>
                        </div>
                    ))}
            </div>
            <div className="compact-popout-divider" />
            <div className="compact-popout-disable" onClick={() => { toggleCompactMode(); closePopout(); }}>
                Disable Compact Mode
            </div>
        </div>
    );
}

function CompactSettingsPopout({ closePopout }: { closePopout: () => void; }) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        stealthListeners.add(listener);
        window.addEventListener("youcord-compact-change", listener);
        window.addEventListener("youcord-stealth-change", listener);
        return () => {
            compactListeners.delete(listener);
            stealthListeners.delete(listener);
            window.removeEventListener("youcord-compact-change", listener);
            window.removeEventListener("youcord-stealth-change", listener);
        };
    }, []);

    const compact = isCompactModeEnabled();
    const stealth = isStealthModeEnabled();

    return (
        <div className="nc-settings-popout">
            <div className="nc-settings-popout-title">Quick Settings</div>

            <div className="nc-settings-popout-section-label">Appearance</div>

            <div className="nc-settings-popout-row" onClick={() => toggleCompactMode()}>
                <div className="nc-settings-popout-row-info">
                    <div className="nc-settings-popout-row-name">Compact Mode</div>
                    <div className="nc-settings-popout-row-desc">Hide plugin buttons behind a single icon</div>
                </div>
                <div className={`nc-settings-popout-toggle ${compact ? "nc-on" : ""}`} onClick={e => { e.stopPropagation(); toggleCompactMode(); }}>
                    <div className="nc-settings-popout-toggle-knob" />
                </div>
            </div>

            <div className="nc-settings-popout-row" onClick={() => toggleStealthMode()}>
                <div className="nc-settings-popout-row-info">
                    <div className="nc-settings-popout-row-name">Stealth Mode</div>
                    <div className="nc-settings-popout-row-desc">Hide all YouCord UI elements</div>
                </div>
                <div className={`nc-settings-popout-toggle ${stealth ? "nc-on" : ""}`} onClick={e => { e.stopPropagation(); toggleStealthMode(); }}>
                    <div className="nc-settings-popout-toggle-knob" />
                </div>
            </div>

            <div className="nc-settings-popout-divider" />

            <div className="nc-settings-popout-section-label">Plugin Buttons</div>
            <div className="nc-settings-popout-grid">
                {Array.from(headerBarButtons)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([id, { render: Button }]) => (
                        <div key={id} style={{ display: "contents" }}>
                            <ErrorBoundary noop>
                                <Button />
                            </ErrorBoundary>
                        </div>
                    ))}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// TOGGLE COMPONENTS
// ══════════════════════════════════════════════════════════════════

function CompactHeaderBarToggle() {
    const [, forceUpdate] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        window.addEventListener("youcord-compact-change", listener);
        return () => {
            compactListeners.delete(listener);
            window.removeEventListener("youcord-compact-change", listener);
        };
    }, []);

    return (
        <div style={{ display: "flex", alignItems: "center" }}>
            <Popout
                targetElementRef={popoutRef}
                renderPopout={() => <CompactHeaderPopout type="header" closePopout={() => setIsOpen(false)} />}
                shouldShow={isOpen}
                onRequestClose={() => setIsOpen(false)}
                position="bottom"
                align="right"
                spacing={8}
            >
                {() => (
                    <div ref={popoutRef as any} style={{ display: "flex" }}>
                        <HeaderBarButton
                            icon={GridVerticalIcon}
                            tooltip="Compact Mode"
                            onClick={() => setIsOpen(v => !v)}
                            selected={isOpen}
                        />
                    </div>
                )}
            </Popout>
            <HeaderBarButton
                icon={GearIcon}
                tooltip="YouCord Settings"
                onClick={() => openYouCordModal()}
            />
        </div>
    );
}

function CompactChannelToolbarToggle() {
    const [, forceUpdate] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        window.addEventListener("youcord-compact-change", listener);
        return () => {
            compactListeners.delete(listener);
            window.removeEventListener("youcord-compact-change", listener);
        };
    }, []);

    return (
        <Popout
            targetElementRef={popoutRef}
            renderPopout={() => <CompactHeaderPopout type="channel" closePopout={() => setIsOpen(false)} />}
            shouldShow={isOpen}
            onRequestClose={() => setIsOpen(false)}
            position="bottom"
            align="right"
            spacing={8}
        >
            {() => (
                <div ref={popoutRef as any} style={{ display: "flex" }}>
                    <ChannelToolbarButton
                        icon={GridVerticalIcon}
                        tooltip="Compact Mode"
                        onClick={() => setIsOpen(v => !v)}
                        selected={isOpen}
                    />
                </div>
            )}
        </Popout>
    );
}

// ══════════════════════════════════════════════════════════════════
// MAIN RENDER COMPONENTS
// ══════════════════════════════════════════════════════════════════

function HeaderBarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        headerBarListeners.add(listener);
        stealthListeners.add(listener);
        compactListeners.add(listener);
        window.addEventListener("youcord-stealth-change", listener);
        window.addEventListener("youcord-compact-change", listener);
        return () => {
            headerBarListeners.delete(listener);
            stealthListeners.delete(listener);
            compactListeners.delete(listener);
            window.removeEventListener("youcord-stealth-change", listener);
            window.removeEventListener("youcord-compact-change", listener);
        };
    }, []);

    if (isStealthModeEnabled() || areHeaderBarButtonsHidden()) return null;

    if (isCompactModeEnabled()) {
        return (
            <div className="vc-header-bar-btns" style={{ display: "contents" }}>
                <CompactHeaderBarToggle />
            </div>
        );
    }

    return (
        <div className="vc-header-bar-btns" style={{ display: "contents" }}>
            {Array.from(headerBarButtons)
                .sort(([, a], [, b]) => a.priority - b.priority)
                .map(([id, { render: Button }]) => (
                    <ErrorBoundary noop key={id} onError={e => logger.error(`Failed to render header bar button: ${id}`, e.error)}>
                        <Button />
                    </ErrorBoundary>
                ))}
        </div>
    );
}

function ChannelToolbarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        channelToolbarListeners.add(listener);
        stealthListeners.add(listener);
        compactListeners.add(listener);
        window.addEventListener("youcord-stealth-change", listener);
        window.addEventListener("youcord-compact-change", listener);
        return () => {
            channelToolbarListeners.delete(listener);
            stealthListeners.delete(listener);
            compactListeners.delete(listener);
            window.removeEventListener("youcord-stealth-change", listener);
            window.removeEventListener("youcord-compact-change", listener);
        };
    }, []);

    if (isStealthModeEnabled()) return null;

    if (isCompactModeEnabled()) {
        return (
            <div className="vc-channel-toolbar-btns" style={{ display: "contents" }}>
                <CompactChannelToolbarToggle />
            </div>
        );
    }

    return (
        <div className="vc-channel-toolbar-btns" style={{ display: "contents" }}>
            {Array.from(channelToolbarButtons)
                .sort(([, a], [, b]) => a.priority - b.priority)
                .map(([id, { render: Button }]) => (
                    <ErrorBoundary noop key={id} onError={e => logger.error(`Failed to render channel toolbar button: ${id}`, e.error)}>
                        <Button />
                    </ErrorBoundary>
                ))}
        </div>
    );
}

/** @internal Injected by HeaderBarAPI patch (do NOT call directly) */
export function _addHeaderBarButtons() {
    return [
        <style key="youcord-headerbar-style">{`
            #youcord-titlebar-btn {
                -webkit-app-region: no-drag;
                position: fixed;
                top: 3px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10010;
                height: 28px;
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 2px 10px 2px 6px;
                border: 1px solid transparent;
                border-radius: 8px;
                background: transparent;
                color: var(--interactive-normal, #b5bac1);
                font: 700 13px/1 var(--font-primary, sans-serif);
                cursor: pointer;
                transition: color .15s ease, background-color .15s ease, border-color .15s ease;
            }
            #youcord-titlebar-btn:hover {
                color: var(--interactive-active, #fff);
                background: var(--background-modifier-hover, rgb(255 255 255 / 8%));
                border-color: rgb(255 255 255 / 8%);
            }
            #youcord-titlebar-btn:focus-visible {
                outline: 2px solid var(--brand-500, #5865f2);
                outline-offset: 1px;
            }
            .youcord-header-btn {
                display: flex;
                align-items: center;
                margin: 0 2px;
                padding: 3px;
                border-radius: 4px;
                color: var(--interactive-normal, oklab(0.745437 0.00131872 -0.00849736)) !important;
                transition: background-color 0.15s ease-out, color 0.15s ease-out;
            }
            .youcord-header-btn:hover {
                background-color: var(--background-modifier-hover, rgba(78, 80, 88, 0.3));
                color: var(--interactive-hover, oklab(0.89908 -0.00192902 -0.01033)) !important;
            }
        `}</style>,
        <YouCordTitleLink key="youcord-titlebar-link" />,
        <HeaderBarButtons key="vc-header-bar-buttons" />
    ];
}

/** @internal Injected by HeaderBarAPI patch (do NOT call directly) */
export function _addChannelToolbarButtons(children: any[]) {
    children.push(<ChannelToolbarButtons key="vc-channel-toolbar-buttons" />);
}
