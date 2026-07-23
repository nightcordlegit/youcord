/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@api/i18n";
import { showNotice } from "@api/Notices";
import { tPlugin } from "@api/pluginI18n";
import { isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { Button } from "@components/Button";
import { HeadingPrimary } from "@components/Heading";
import { CogWheel } from "@components/Icons";
import { AddonCard } from "@components/settings/AddonCard";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize,openModal } from "@utils/modal";
import { OptionType, Plugin } from "@utils/types";
import { React, showToast, Text, Toasts, Tooltip, UserStore } from "@webpack/common";
import { Settings } from "Vencord";

import { PluginMeta } from "~plugins";

import { openPluginModal } from "./PluginModal";
import { getTutorialVideoName } from "./tutorialList";

const logger = new Logger("PluginCard");
const cl = classNameFactory("vc-plugins-");

interface PluginCardProps extends React.HTMLProps<HTMLDivElement> {
    plugin: Plugin;
    disabled?: boolean;
    onRestartNeeded(name: string, key: string): void;
    isNew?: boolean;
    hasTutorial?: boolean;
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

export function PluginCard({ plugin, disabled, onRestartNeeded, onMouseEnter, onMouseLeave, isNew, hasTutorial }: PluginCardProps) {
    const settings = Settings.plugins[plugin.name];
    const isEnabled = () => isPluginEnabled(plugin.name);

    function doToggleEnabled() {
        const wasEnabled = isEnabled();

        if (!wasEnabled) {
            const { restartNeeded, failures } = startDependenciesRecursive(plugin);

            if (failures.length) {
                logger.error(`Failed to start dependencies for ${plugin.name}: ${failures.join(", ")}`);
                showNotice("Failed to start dependencies: " + failures.join(", "), "Close", () => null);
                return;
            }

            if (restartNeeded) {
                settings.enabled = true;
                onRestartNeeded(plugin.name, "enabled");
                return;
            }
        }

        if (pluginRequiresRestart(plugin)) {
            settings.enabled = !wasEnabled;
            onRestartNeeded(plugin.name, "enabled");
            return;
        }

        if (wasEnabled && !plugin.started) {
            settings.enabled = !wasEnabled;
            return;
        }

        const result = wasEnabled ? stopPlugin(plugin) : startPlugin(plugin);

        if (!result) {
            settings.enabled = false;

            const msg = `Error while ${wasEnabled ? "stopping" : "starting"} plugin ${plugin.name}`;
            showToast(msg, Toasts.Type.FAILURE, {
                position: Toasts.Position.BOTTOM,
            });

            return;
        }

        settings.enabled = !wasEnabled;
    }

    function toggleEnabled() {
        const wasEnabled = isEnabled();
        if (!wasEnabled && plugin.name.toLowerCase() === "autoresponder") {
            openModal(props => (
                <ModalRoot {...props} size={ModalSize.SMALL}>
                    <ModalHeader separator={false}>
                        <Text variant="heading-lg/semibold">{t("Autoresponder Warning")}</Text>
                        <ModalCloseButton onClick={props.onClose} />
                    </ModalHeader>
                    <ModalContent>
                        <Text variant="text-md/normal" style={{ marginBottom: 16 }}>
                            {t("Are you sure you want to enable the Autoresponder plugin? An AI will automatically reply to your DMs when you are unavailable.")}
                        </Text>
                    </ModalContent>
                    <div style={{ padding: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <Button
                            variant="link"
                            onClick={props.onClose}
                        >
                            {t("Cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                props.onClose();
                                doToggleEnabled();
                            }}
                        >
                            {t("Enable")}
                        </Button>
                    </div>
                </ModalRoot>
            ));
            return;
        }
        doToggleEnabled();
    }

    const openTutorialVideo = (e: React.MouseEvent) => {
        e.stopPropagation();
        // The video filename on disk does not always exactly match plugin.name
        // (case differences, or a handful of fully different names), so resolve it
        // through the mapping instead of assuming they are identical. Also always
        // URL-encode the segment since some filenames contain spaces (e.g. "Fake Voice Option.mp4").
        const videoName = getTutorialVideoName(plugin.name) ?? plugin.name;
        const videoUrl = `https://raw.githubusercontent.com/nightcordlegit/youcord-tutorials/main/videos/${encodeURIComponent(videoName)}.mp4`;
        openModal(props => (
            <ModalRoot {...props} size={ModalSize.DYNAMIC} className="nc-tutorial-modal">
                <ModalHeader separator={false}>
                    <Text variant="heading-xl/bold" style={{ flex: 1, color: "#fff" }}>
                        {plugin.name} â€“ Tutorial
                    </Text>
                    <ModalCloseButton onClick={props.onClose} />
                </ModalHeader>
                <ModalContent>
                    <div style={{ padding: "0 16px 16px" }}>
                        <video
                            src={videoUrl}
                            controls
                            autoPlay
                            style={{
                                width: "100%",
                                borderRadius: "8px",
                                background: "#000",
                            }}
                            onError={e => {
                                const el = e.currentTarget;
                                el.style.display = "none";
                                const msg = el.parentElement?.querySelector(".nc-video-error") as HTMLElement;
                                if (msg) msg.style.display = "flex";
                            }}
                        />
                        <div
                            className="nc-video-error"
                            style={{
                                display: "none",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "48px 24px",
                                color: "var(--text-muted)",
                                gap: "8px",
                            }}
                        >
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="var(--text-muted)" />
                            </svg>
                            <Text variant="text-md/medium">{t("No video tutorial available for this plugin.")}</Text>
                        </div>
                    </div>
                </ModalContent>
            </ModalRoot>
        ));
    };

    const sourceBadge = (
        <button
            onClick={openTutorialVideo}
            style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                color: "var(--interactive-normal)",
                transition: "color 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--interactive-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--interactive-normal)"; }}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
        </button>
    );

    const tooltip = t("Show Tutorial");
    const isYouCord = !PluginMeta[plugin.name]?.userPlugin;
    const iconType = isYouCord ? "youcord" : "other";

    function openCreditsModal() {
        openModal(props => (
            <ModalRoot {...props} size={ModalSize.SMALL}>
                <ModalHeader>
                    <HeadingPrimary>Credits - {plugin.name}</HeadingPrimary>
                    <ModalCloseButton onClick={props.onClose} />
                </ModalHeader>
                <ModalContent style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" } as any}>
                    {isYouCord ? (
                        <a href="https://github.com/nightcordlegit/youcord" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "var(--text-normal)", fontSize: "20px", fontWeight: 600 }}>
                            <img src="https://i.ibb.co/R4HWcpYH/Chat-GPT-Image-12-juil-2026-19-31-03-removebg-preview.png" alt="YouCord" style={{ width: 64, height: 64, borderRadius: "50%" }} />
                            YouCord
                        </a>
                    ) : (
                        plugin.authors?.map(a => {
                            const user = UserStore.getUser(a.id.toString());
                            const avatarUrl = user ? user.getAvatarURL(undefined, 128) : `https://cdn.discordapp.com/avatars/${a.id}/${a.id}.png`;
                            return (
                                <div key={a.id.toString()} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "20px", fontWeight: 600, color: "var(--text-normal)" }}>
                                    <img src={avatarUrl} alt={a.name} style={{ width: 64, height: 64, borderRadius: "50%" }} />
                                    <span>{a.name}</span>
                                </div>
                            );
                        })
                    )}
                </ModalContent>
            </ModalRoot>
        ));
    }

    const hasSettings = plugin.settings?.def && Object.values(plugin.settings.def).some(s => s.type !== OptionType.CUSTOM && !s.hidden);

    const PluginIcon = plugin.headerBarButton?.icon ||
                       plugin.chatBarButton?.icon ||
                       plugin.messagePopoverButton?.icon ||
                       plugin.userAreaButton?.icon;

    return (
        <AddonCard
            name={plugin.name}
            iconType={iconType}
            customIcon={PluginIcon}
            sourceBadge={hasTutorial ? sourceBadge : undefined}
            tooltip={tooltip}
            description={tPlugin(plugin.description)}
            isNew={isNew}
            enabled={isEnabled()}
            setEnabled={plugin.required ? () => { } : toggleEnabled}
            disabled={disabled}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            infoButton={
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {(plugin.name === "DynamicIslande" || plugin.name === "StereoInstaller" || plugin.name === "ClientDiagnostics" || plugin.name === "SecureBookmarks" || plugin.name === "StatusCycler" || plugin.name === "Surveillance") && (
                        <Tooltip text="This plugin comes from our partner (Illegalcord) then was modified by YouCord.">
                            {({ onMouseEnter, onMouseLeave }) => (
                                <button
                                    role="button"
                                    className={cl("info-button")}
                                    onMouseEnter={onMouseEnter}
                                    onMouseLeave={onMouseLeave}
                                    onClick={() => window.open("https://github.com/ImHisako/Illegalcord", "_blank")}
                                >
                                    <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M14.5 8a3 3 0 1 0-2.7-4.3c-.2.4.06.86.44 1.12a5 5 0 0 1 2.14 3.08c.01.06.06.1.12.1ZM18.44 17.27c.15.43.54.73 1 .73h1.06c.83 0 1.5-.67 1.5-1.5a7.5 7.5 0 0 0-6.5-7.43c-.55-.08-.99.38-1.1.92-.06.3-.15.6-.26.87-.23.58-.05 1.3.47 1.63a9.53 9.53 0 0 1 3.83 4.78ZM12.5 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2 20.5a7.5 7.5 0 0 1 15 0c0 .83-.67 1.5-1.5 1.5a.2.2 0 0 1-.2-.16c-.2-.96-.56-1.87-.88-2.54-.1-.23-.42-.15-.42.1v2.1a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2.1c0-.25-.31-.33-.42-.1-.32.67-.67 1.58-.88 2.54a.2.2 0 0 1-.2.16A1.5 1.5 0 0 1 2 20.5Z" />
                                    </svg>
                                </button>
                            )}
                        </Tooltip>
                    )}
                    {hasSettings && (
                        <button
                            role="button"
                            onClick={() => openPluginModal(plugin, onRestartNeeded)}
                            className={cl("info-button")}
                        >
                            <CogWheel className={cl("info-icon")} />
                        </button>
                    )}
                </div>
            } />
    );
}
