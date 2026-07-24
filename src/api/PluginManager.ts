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

import { addProfileBadge, removeProfileBadge } from "@api/Badges";
import { addChatBarButton, removeChatBarButton } from "@api/ChatButtons";
import { registerCommand, unregisterCommand } from "@api/Commands";
import { addContextMenuPatch, removeContextMenuPatch } from "@api/ContextMenu";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { addMessageAccessory, removeMessageAccessory } from "@api/MessageAccessories";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import { addMessageClickListener, addMessagePreEditListener, addMessagePreSendListener, removeMessageClickListener, removeMessagePreEditListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { addMessagePopoverButton, removeMessagePopoverButton } from "@api/MessagePopover";
import { addNicknameIcon, removeNicknameIcon } from "@api/NicknameIcons";
import { Settings, SettingsStore } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Logger } from "@utils/Logger";
import { onlyOnce } from "@utils/onlyOnce";
import { canonicalizeFind, canonicalizeReplacement } from "@utils/patches";
import { Patch, Plugin, PluginDef, ReporterTestable, StartAt } from "@utils/types";
import { FluxEvents } from "@vencord/discord-types";
import { FluxDispatcher } from "@webpack/common";
import { patches } from "@webpack/patcher";

import { PluginMeta } from "~pluginMeta";
export { PluginMeta as pluginMeta };
import Plugins from "~plugins";
export { Plugins as plugins };

import { traceFunction } from "../debug/Tracer";
import { addAudioProcessor, removeAudioProcessor } from "./AudioPlayer";
import { addChannelToolbarButton, addHeaderBarButton, removeChannelToolbarButton, removeHeaderBarButton } from "./HeaderBar";
import { addUserAreaButton, removeUserAreaButton } from "./UserArea";

const logger = new Logger("PluginManager", "#a6d189");

export const PMLogger = logger;

/** Tracks plugins auto-enabled as dependencies of other plugins */
const dependencyPlugins = new Set<string>();

/** Whether we have subscribed to flux events of all the enabled plugins when FluxDispatcher was ready */
let enabledPluginsSubscribedFlux = false;
const subscribedFluxEventsPlugins = new Set<string>();

export function isPluginEnabled(p: string) {
    const meta = PluginMeta[p];
    if (!meta) return false;

    return (
        meta.required ||
        dependencyPlugins.has(p) ||
        (Settings as any)?.plugins?.[p]?.enabled
    ) ?? false;
}

/** Schedule a function to run during browser idle time, falling back to setTimeout */
function scheduleIdleCallback(fn: () => void, timeout = 2000) {
    if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(fn, { timeout });
    } else {
        setTimeout(fn, 1);
    }
}

export function isSettingDisabled(definedSettings: any, setting: any): boolean {
    if (typeof setting.disabled === "function") {
        return setting.disabled.call(definedSettings);
    }
    return setting.disabled ?? false;
}

export function hasAnyVisibleSettings(plugin: Plugin): boolean {
    if (!plugin.settings) return false;
    return Object.values(plugin.settings.def).some(
        s => s.type !== undefined && !s.hidden
    );
}

export function isPluginRequired(p: string) {
    return (
        Plugins[p]?.required
    ) ?? false;
}

export function addPatch(newPatch: Omit<Patch, "plugin">, pluginName: string, pluginPath = `Vencord.Plugins.plugins[${JSON.stringify(pluginName)}]`) {
    const patch = newPatch as Patch;
    patch.plugin = pluginName;

    if (IS_REPORTER) {
        delete patch.predicate;
        delete patch.group;
    }

    if (patch.predicate && !patch.predicate()) return;

    canonicalizeFind(patch);
    if (!Array.isArray(patch.replacement)) {
        patch.replacement = [patch.replacement];
    }

    for (const replacement of patch.replacement) {
        canonicalizeReplacement(replacement, pluginPath);

        if (IS_REPORTER) {
            delete replacement.predicate;
        }
    }

    patch.replacement = patch.replacement.filter(({ predicate }) => !predicate || predicate());

    patches.push(patch);
}

function isReporterTestable(p: Plugin, part: ReporterTestable) {
    return p.reporterTestable == null
        ? true
        : (p.reporterTestable & part) === part;
}

export function pluginRequiresRestart(p: Plugin) {
    return p.requiresRestart !== false && (p.requiresRestart || !!p.patches?.length);
}

export const startAllPlugins = traceFunction("startAllPlugins", function startAllPlugins(target: StartAt) {
    const names = Object.keys(Plugins);
    const enabled = names.filter(n => isPluginEnabled(n));
    logger.info(`Starting plugins (stage ${target}, ${enabled.length} enabled)`);

    if (target === StartAt.DOMContentLoaded) {
        const deferred = enabled.filter(n => (Plugins[n].startAt ?? StartAt.WebpackReady) === target);
        if (deferred.length > 0) {
            scheduleIdleCallback(() => {
                for (const name of deferred) {
                    if (!isPluginEnabled(name)) continue;
                    const p = Plugins[name];
                    if (p.started) continue;
                    startPlugin(p);
                }
            });
        }
        return;
    }

    for (const name of enabled) {
        const p = Plugins[name];
        const startAt = p.startAt ?? StartAt.WebpackReady;
        if (startAt !== target) continue;
        if (p.started) continue;
        if (IS_REPORTER && !isReporterTestable(p, ReporterTestable.Start)) continue;
        startPlugin(p);
    }
});

export function startDependenciesRecursive(p: Plugin) {
    const settings = Settings.plugins;
    let restartNeeded = false;
    const failures: string[] = [];

    p.dependencies?.forEach(d => {
        if (!settings[d].enabled) {
            const dep = Plugins[d];
            startDependenciesRecursive(dep);

            settings[d].enabled = true;
            dependencyPlugins.add(d);

            if (pluginRequiresRestart(dep)) {
                logger.warn(`Enabling dependency ${d} requires restart.`);
                restartNeeded = true;
                return;
            }

            const result = startPlugin(dep);
            if (!result) failures.push(d);
        }
    });

    return { restartNeeded, failures };
}

export function subscribePluginFluxEvents(p: Plugin, fluxDispatcher: typeof FluxDispatcher) {
    if (p.flux && !subscribedFluxEventsPlugins.has(p.name) && (!IS_REPORTER || isReporterTestable(p, ReporterTestable.FluxEvents))) {
        subscribedFluxEventsPlugins.add(p.name);

        logger.debug("Subscribing to flux events of plugin", p.name);
        for (const [event, handler] of Object.entries(p.flux)) {
            const wrappedHandler = p.flux[event] = function () {
                if (p.name === "Encryptcord" && event === "MESSAGE_CREATE") return;
                try {
                    const res = handler!.apply(p, arguments as any);
                    return res instanceof Promise
                        ? res.catch(e => logger.error(`${p.name}: Error while handling ${event}\n`, e))
                        : res;
                } catch (e) {
                    logger.error(`${p.name}: Error while handling ${event}\n`, e);
                }
            };

            fluxDispatcher.subscribe(event as FluxEvents, wrappedHandler);
        }
    }
}

export function unsubscribePluginFluxEvents(p: Plugin, fluxDispatcher: typeof FluxDispatcher) {
    if (p.flux) {
        subscribedFluxEventsPlugins.delete(p.name);

        logger.debug("Unsubscribing from flux events of plugin", p.name);
        for (const [event, handler] of Object.entries(p.flux)) {
            fluxDispatcher.unsubscribe(event as FluxEvents, handler!);
        }
    }
}

export function subscribeAllPluginsFluxEvents(fluxDispatcher: typeof FluxDispatcher) {
    enabledPluginsSubscribedFlux = true;

    for (const name in Plugins) {
        if (!isPluginEnabled(name)) continue;
        subscribePluginFluxEvents(Plugins[name], fluxDispatcher);
    }
}

export const startPlugin = traceFunction("startPlugin", function startPlugin(p: Plugin) {
    const {
        name, commands, contextMenus, managedStyle, userProfileBadges,
        onBeforeMessageEdit, onBeforeMessageSend, onMessageClick,
        renderChatBarButton, chatBarButton, renderMemberListDecorator, renderMessageAccessory, renderMessageDecoration, renderMessagePopoverButton, messagePopoverButton,
        // Custom
        renderNicknameIcon, headerBarButton, audioProcessor, userAreaButton
    } = p;

    if (p.start) {
        logger.info("Starting plugin", name);
        if (p.started) {
            logger.warn(`${name} already started`);
            return false;
        }
        try {
            p.start();
        } catch (e) {
            logger.error(`Failed to start ${name}\n`, e);
            return false;
        }
    }

    p.started = true;

    if (commands?.length) {
        logger.debug("Registering commands of plugin", name);
        for (const cmd of commands) {
            try {
                registerCommand(cmd, name);
            } catch (e) {
                logger.error(`Failed to register command ${cmd.name}\n`, e);
                return false;
            }
        }
    }

    if (enabledPluginsSubscribedFlux) {
        subscribePluginFluxEvents(p, FluxDispatcher);
    }

    if (contextMenus) {
        logger.debug("Adding context menus patches of plugin", name);
        for (const navId in contextMenus) {
            addContextMenuPatch(navId, contextMenus[navId]);
        }
    }

    if (managedStyle) enableStyle(managedStyle);

    if (userProfileBadges) userProfileBadges.forEach(e => addProfileBadge(e));

    if (onBeforeMessageEdit) addMessagePreEditListener(onBeforeMessageEdit);
    if (onBeforeMessageSend) addMessagePreSendListener(onBeforeMessageSend);
    if (onMessageClick) addMessageClickListener(onMessageClick);

    if (chatBarButton) addChatBarButton(name, chatBarButton.render, chatBarButton.icon);
    // @ts-expect-error: legacy code doesn't have icon
    else if (renderChatBarButton) addChatBarButton(name, renderChatBarButton);
    if (renderMemberListDecorator) addMemberListDecorator(name, renderMemberListDecorator);
    if (renderMessageDecoration) addMessageDecoration(name, renderMessageDecoration);
    if (renderMessageAccessory) addMessageAccessory(name, renderMessageAccessory);
    if (messagePopoverButton) addMessagePopoverButton(name, messagePopoverButton.render, messagePopoverButton.icon);
    // @ts-expect-error: legacy code doesn't have icon
    else if (renderMessagePopoverButton) addMessagePopoverButton(name, renderMessagePopoverButton);

    // Custom
    if (renderNicknameIcon) addNicknameIcon(name, renderNicknameIcon);
    if (headerBarButton) {
        if (headerBarButton.location === "channeltoolbar") {
            addChannelToolbarButton(name, headerBarButton.render, headerBarButton.priority);
        } else {
            addHeaderBarButton(name, headerBarButton.render, headerBarButton.priority);
        }
    }
    if (audioProcessor) addAudioProcessor(name, audioProcessor);
    if (userAreaButton) addUserAreaButton(name, userAreaButton.render, userAreaButton.priority);

    return true;
}, p => `startPlugin ${p.name}`);

export const stopPlugin = traceFunction("stopPlugin", function stopPlugin(p: Plugin) {
    const {
        name, commands, contextMenus, managedStyle, userProfileBadges,
        onBeforeMessageEdit, onBeforeMessageSend, onMessageClick,
        renderChatBarButton, chatBarButton, renderMemberListDecorator, renderMessageAccessory, renderMessageDecoration, renderMessagePopoverButton, messagePopoverButton,
        // Custom
        renderNicknameIcon, headerBarButton, audioProcessor, userAreaButton
    } = p;

    if (p.stop) {
        logger.info("Stopping plugin", name);
        if (!p.started) {
            logger.warn(`${name} already stopped`);
            return false;
        }
        try {
            p.stop();
        } catch (e) {
            logger.error(`Failed to stop ${name}\n`, e);
            return false;
        }
    }

    p.started = false;

    if (commands?.length) {
        logger.debug("Unregistering commands of plugin", name);
        for (const cmd of commands) {
            try {
                unregisterCommand(cmd.name);
            } catch (e) {
                logger.error(`Failed to unregister command ${cmd.name}\n`, e);
                return false;
            }
        }
    }

    unsubscribePluginFluxEvents(p, FluxDispatcher);

    if (contextMenus) {
        logger.debug("Removing context menus patches of plugin", name);
        for (const navId in contextMenus) {
            removeContextMenuPatch(navId, contextMenus[navId]);
        }
    }

    if (managedStyle) disableStyle(managedStyle);

    if (userProfileBadges) userProfileBadges.forEach(e => removeProfileBadge(e));

    if (onBeforeMessageEdit) removeMessagePreEditListener(onBeforeMessageEdit);
    if (onBeforeMessageSend) removeMessagePreSendListener(onBeforeMessageSend);
    if (onMessageClick) removeMessageClickListener(onMessageClick);

    if (chatBarButton || renderChatBarButton) removeChatBarButton(name);
    if (renderMemberListDecorator) removeMemberListDecorator(name);
    if (renderMessageDecoration) removeMessageDecoration(name);
    if (renderMessageAccessory) removeMessageAccessory(name);
    if (messagePopoverButton || renderMessagePopoverButton) removeMessagePopoverButton(name);

    // Custom
    if (renderNicknameIcon) removeNicknameIcon(name);
    if (headerBarButton) {
        if (headerBarButton.location === "channeltoolbar") {
            removeChannelToolbarButton(name);
        } else {
            removeHeaderBarButton(name);
        }
    }
    if (audioProcessor) removeAudioProcessor(name);
    if (userAreaButton) removeUserAreaButton(name);

    return true;
}, p => `stopPlugin ${p.name}`);

export const initPluginManager = onlyOnce(function init() {
    const settings = Settings.plugins;

    const pluginKeysToBind: Array<keyof PluginDef & `${"on" | "render"}${string}`> = [
        "onBeforeMessageEdit", "onBeforeMessageSend", "onMessageClick",
        "renderChatBarButton", "renderMemberListDecorator", "renderMessageAccessory", "renderMessageDecoration", "renderMessagePopoverButton",
        "renderNicknameIcon"
    ];

    const neededApiPlugins = new Set<string>();

    // Migration: force tous les plugins a OFF sauf required/enabledByDefault
    const MIGRATION_FLAG = "__youcord_default_off_v1__";
    if (!(SettingsStore.plain as any)[MIGRATION_FLAG]) {
        for (const name in PluginMeta) {
            const meta = PluginMeta[name];
            const shouldBeOn = meta.required || meta.enabledByDefault;
            if (!shouldBeOn) {
                const s = SettingsStore.plain.plugins[name];
                if (s) s.enabled = false;
            }
        }
        (SettingsStore.plain as any)[MIGRATION_FLAG] = true;
        SettingsStore.markAsChanged();
    }

    // Use PluginMeta for dependency resolution and API detection (no plugin module eval)
    for (const name in PluginMeta) {
        if (!isPluginEnabled(name)) continue;
        const meta = PluginMeta[name];

        meta.dependencies?.forEach(d => {
            settings[d].enabled = true;
            dependencyPlugins.add(d);
        });

        const f = meta.features;
        if (f.commands) neededApiPlugins.add("CommandsAPI");
        if (f.messageEvents) neededApiPlugins.add("MessageEventsAPI");
        if (f.chatBarButton) neededApiPlugins.add("ChatInputButtonAPI");
        if (f.memberListDecorator) neededApiPlugins.add("MemberListDecoratorsAPI");
        if (f.messageAccessory) neededApiPlugins.add("MessageAccessoriesAPI");
        if (f.messageDecoration) neededApiPlugins.add("MessageDecorationsAPI");
        if (f.messagePopover) neededApiPlugins.add("MessagePopoverAPI");
        if (f.badges) neededApiPlugins.add("BadgeAPI");
        if (f.nicknameIcon) neededApiPlugins.add("NicknameIconsAPI");
        if (f.headerBarButton) neededApiPlugins.add("HeaderBarAPI");
        if (f.audioProcessor) neededApiPlugins.add("AudioPlayerAPI");
        if (f.userAreaButton) neededApiPlugins.add("UserAreaAPI");
    }

    for (const p of neededApiPlugins) {
        dependencyPlugins.add(p);
        settings[p].enabled = true;
    }

    // Second pass: settings init and patch registration for enabled plugins only
    for (const name in PluginMeta) {
        if (!isPluginEnabled(name)) continue;
        const p = Plugins[name];
        if (!p) continue;

        for (const key of pluginKeysToBind) {
            p[key] &&= (p[key] as Function).bind(p) as any;
        }

        if (p.settings) {
            p.options ??= {};

            p.settings.pluginName = p.name;
            for (const sName in p.settings.def) {
                const def = p.settings.def[sName];
                const checks = p.settings.checks?.[sName];
                p.options[sName] = { ...def, ...checks };
            }
        }

        if (p.options) {
            for (const optName in p.options) {
                const opt = p.options[optName];
                if (opt.onChange != null) {
                    SettingsStore.addChangeListener(`plugins.${p.name}.${optName}`, opt.onChange);
                }
            }
        }

        if (p.patches && (!IS_REPORTER || isReporterTestable(p, ReporterTestable.Patches))) {
            for (const patch of p.patches) {
                addPatch(patch, p.name);
            }
        }
    }
});
