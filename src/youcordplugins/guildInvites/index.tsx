/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { ChannelStore, FluxDispatcher, GuildMemberStore, Menu, React, RestAPI, showToast, Toasts, useCallback, useEffect, useRef, UserStore,useState } from "@webpack/common";

const MY_GROUP_ID = "gi-invites-group";

interface GuildInvite {
    code: string;
    uses: number;
    max_uses: number | null;
    created_at: string;
    expires_at: string | null;
    inviter?: { id: string; username: string; global_name?: string | null; avatar?: string | null; };
    channel_id: string;
    channel_name?: string;
    guild_id: string;
}

interface InvitesState {
    status: "loading" | "ready" | "forbidden" | "error";
    invites: GuildInvite[];
}

const cache = new Map<string, { invites: GuildInvite[]; fetchedAt: number }>();
const liveInvites = new Map<string, Map<string, GuildInvite | null>>();

function channelName(inv: GuildInvite): string {
    if (inv.channel_name) return inv.channel_name;
    try {
        return ChannelStore.getChannel(inv.channel_id)?.name ?? "inconnu";
    } catch {
        return "inconnu";
    }
}

function inviterName(inv: GuildInvite): string {
    return inv.inviter?.global_name || inv.inviter?.username || "Inconnu";
}

async function fetchInvites(guildId: string): Promise<{ ok: true; invites: GuildInvite[] } | { ok: false; forbidden: boolean }> {
    try {
        const res: any = await RestAPI.get({ url: `/guilds/${guildId}/invites` });
        if (res?.status === 403 || (!Array.isArray(res?.body) && res?.body?.message)) return { ok: false, forbidden: res?.status === 403 };
        if (!Array.isArray(res?.body)) return { ok: false, forbidden: false };
        return {
            ok: true,
            invites: res.body.map((invite: any): GuildInvite => ({
                code: invite.code,
                uses: invite.uses ?? 0,
                max_uses: invite.max_uses ?? null,
                created_at: invite.created_at ?? "",
                expires_at: invite.expires_at ?? null,
                inviter: invite.inviter,
                channel_id: invite.channel?.id ?? "",
                channel_name: invite.channel?.name ?? invite.channel?.label ?? "",
                guild_id: guildId,
            })),
        };
    } catch {
        return { ok: false, forbidden: false };
    }
}

function isExpired(inv: GuildInvite): boolean {
    return !!inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
}

function hasLeftServer(inv: GuildInvite): boolean {
    if (!inv.inviter) return false;
    try {
        return !GuildMemberStore.isMember(inv.guild_id, inv.inviter.id);
    } catch {
        return false;
    }
}

function mergeInvites(base: GuildInvite[], guildId: string): GuildInvite[] {
    const map = new Map(base.map(i => [i.code, i]));
    const live = liveInvites.get(guildId);
    if (live) {
        for (const [code, inv] of live) {
            if (inv == null) map.delete(code);
            else map.set(code, inv);
        }
    }
    return [...map.values()].sort((a, b) => b.uses - a.uses);
}

function trackInvite(guildId: string, code: string, inv: GuildInvite | null) {
    let m = liveInvites.get(guildId);
    if (!m) liveInvites.set(guildId, m = new Map());
    m.set(code, inv);
}

function copyInviteCode(code: string) {
    navigator.clipboard.writeText(`https://discord.gg/${code}`)
        .then(() => showToast(`Invitation copiée : ${code}`, Toasts.Type.SUCCESS))
        .catch(() => { });
}

function onInviteFluxEvent(e: any) {
    const guildId = e.guildId ?? e.guild_id;
    if (!guildId) return;

    if (e.type === "INVITE_CREATE") {
        trackInvite(guildId, e.code, {
            code: e.code,
            uses: e.uses ?? 0,
            max_uses: e.max_uses ?? null,
            created_at: e.created_at ?? "",
            expires_at: e.expires_at ?? null,
            inviter: e.inviter,
            channel_id: e.channel_id ?? e.channel?.id ?? "",
            channel_name: e.channel?.name ?? "",
            guild_id: guildId,
        });
    } else if (e.type === "INVITE_DELETE" && e.code) {
        trackInvite(guildId, e.code, null);
    } else if (e.type === "INVITE_DELETE") {
        liveInvites.delete(guildId);
    }
}

function onGuildFluxEvent(e: any) {
    const guildId = e.guildId ?? e.guild_id;
    if (!guildId) return;
    cache.delete(guildId);
    liveInvites.delete(guildId);
}

function useInviteData(guildId: string, forceSync = false) {
    const [state, setState] = useState<InvitesState>({ status: "loading", invites: [] });
    const rt = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback(async (force: boolean) => {
        if (!force) {
            const cached = cache.get(guildId);
            if (cached && Date.now() - cached.fetchedAt < 30_000) {
                setState({ status: "ready", invites: cached.invites });
                return;
            }
        }
        const res = await fetchInvites(guildId);
        if (res.ok) {
            cache.set(guildId, { invites: res.invites, fetchedAt: Date.now() });
            setState({ status: "ready", invites: res.invites });
        } else {
            setState(prev => ({ status: res.forbidden ? "forbidden" : "error", invites: prev.invites }));
        }
    }, [guildId]);

    useEffect(() => {
        load(forceSync);
        const refresh = (e: any) => {
            const gid = e.guildId ?? e.guild_id;
            if (gid !== guildId) return;
            if (rt.current) clearTimeout(rt.current);
            rt.current = setTimeout(() => load(true), 700);
        };
        FluxDispatcher.subscribe("INVITE_CREATE", refresh);
        FluxDispatcher.subscribe("INVITE_DELETE", refresh);
        FluxDispatcher.subscribe("INVITE_UPDATE", refresh);
        FluxDispatcher.subscribe("CHANNEL_DELETE", refresh);
        return () => {
            FluxDispatcher.unsubscribe("INVITE_CREATE", refresh);
            FluxDispatcher.unsubscribe("INVITE_DELETE", refresh);
            FluxDispatcher.unsubscribe("INVITE_UPDATE", refresh);
            FluxDispatcher.unsubscribe("CHANNEL_DELETE", refresh);
            if (rt.current) clearTimeout(rt.current);
        };
    }, [guildId, load, forceSync]);

    return {
        status: state.status,
        invites: mergeInvites(state.invites, guildId),
        reload: () => load(true),
    };
}

function getCurrentUserId(): string | null {
    try {
        return UserStore.getCurrentUser()?.id ?? null;
    } catch {
        return null;
    }
}

function InviteCountLabel({ guildId }: { guildId: string; }) {
    const { status, invites } = useInviteData(guildId);
    const me = getCurrentUserId();

    if (status === "loading") {
        return <span className="gi-count gi-muted">Chargement des invitations…</span>;
    }
    if (invites.length === 0 && (status === "forbidden" || status === "error")) {
        return <span className="gi-count gi-muted">{status === "forbidden" ? "Permission insuffisante (Gérer le serveur)" : "Impossible de charger les invitations"}</span>;
    }
    const myUses = invites.reduce((sum, inv) => sum + (inv.inviter?.id === me ? inv.uses : 0), 0);
    return (
        <span className="gi-count">
            👥 Vous avez ajouté {myUses} membre{myUses > 1 ? "s" : ""} · {invites.length} lien{invites.length > 1 ? "s" : ""} actif{invites.length > 1 ? "s" : ""}
        </span>
    );
}

function InviteRow({ inv, guildId }: { inv: GuildInvite; guildId: string; }) {
    const me = getCurrentUserId();
    const mine = inv.inviter?.id === me;
    return (
        <div className="gi-row">
            <div className="gi-row-main">
                <div className="gi-row-title">
                    <span className="gi-row-channel">#{channelName(inv)}</span>
                    {mine
                        ? <span className="gi-row-me">par vous</span>
                        : <span className="gi-row-inviter">par {inviterName(inv)}{hasLeftServer(inv) ? " (a quitté le serveur)" : ""}</span>}
                </div>
                <div className="gi-row-code">{inv.code}</div>
            </div>
            <div className="gi-row-side">
                <span className="gi-row-uses" title="Nombre de personnes ajoutées">{inv.uses}×</span>
                {isExpired(inv) && <span className="gi-row-expired">expirée</span>}
                <button className="gi-copy-btn" title="Copier le lien d'invitation"
                    onClick={() => copyInviteCode(inv.code)}>Copier</button>
            </div>
        </div>
    );
}

function InvitesModal({ rootProps, guildId, guildName }: { rootProps: any; guildId: string; guildName: string; }) {
    const { status, invites, reload } = useInviteData(guildId, true);

    return (
        <ModalRoot {...rootProps} size="medium">
            <ModalHeader separator={false}>
                <span className="gi-modal-title">{guildName}</span>
                <span className="gi-modal-subtitle">Invitations du serveur</span>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent className="gi-content">
                {status === "loading" && <div className="gi-muted gi-pad">Chargement des invitations…</div>}
                {status === "forbidden" && !invites.length && (
                    <div className="gi-notice">Vous n'avez pas la permission de lister les invitations (Gérer le serveur). Seules les invitations créées depuis cette session sont visibles.</div>
                )}
                {status === "error" && !invites.length && (
                    <div className="gi-notice">Impossible de charger les invitations depuis l'API.</div>
                )}
                {invites.length === 0 && status !== "loading" && (
                    <div className="gi-muted gi-pad">Aucune invitation active.</div>
                )}
                {invites.map(inv => <InviteRow key={inv.code} inv={inv} guildId={guildId} />)}
            </ModalContent>
            <ModalFooter className="gi-footer">
                <button className="gi-footer-btn gi-footer-btn-ghost" onClick={reload}>Actualiser</button>
                <button className="gi-footer-btn gi-footer-btn-primary" onClick={rootProps.onClose}>Fermer</button>
            </ModalFooter>
        </ModalRoot>
    );
}

function findContainerById(id: string, children: Array<React.ReactElement<any> | null | undefined>): Array<React.ReactElement<any> | null | undefined> | null {
    for (const child of children) {
        if (child == null) continue;
        if (Array.isArray(child)) {
            const found = findContainerById(id, child);
            if (found !== null) return found;
        }
        if (child.props?.id === id) return children;
        const next = child.props?.children;
        if (next) {
            const arr = Array.isArray(next) ? next : [next];
            const found = findContainerById(id, arr);
            if (found !== null) return found;
        }
    }
    return null;
}

const guildInvitesPatch: NavContextMenuPatchCallback = (children, { guild }: { guild?: any; } = {}) => {
    if (!guild) return;
    try {
        const container = findContainerById("vc-clean-guild-messages", children as any)
            ?? findGroupChildrenByChildId("mark-guild-read", children as any)
            ?? children as any;
        if (!container) return;

        const element = (
            <Menu.MenuGroup key={MY_GROUP_ID} label="Invitations — temps réel">
                <Menu.MenuItem
                    id="gi-count"
                    label={<InviteCountLabel guildId={guild.id} />}
                    disabled
                />
                <Menu.MenuItem
                    id="gi-open"
                    label="Voir toutes les invitations"
                    action={() => openModal(p => (
                        <InvitesModal rootProps={p} guildId={guild.id} guildName={guild.name ?? "Serveur"} />
                    ))}
                />
            </Menu.MenuGroup>
        );

        const cleanIdx = container.findIndex((c: any) => c?.props?.id === "vc-clean-guild-messages");
        if (cleanIdx > 0) {
            container.splice(cleanIdx, 0, element);
        } else {
            container.push(element);
        }
    } catch (e) {
        console.error("[GuildInvites] Context menu patch error:", e);
    }
};

export default definePlugin({
    name: "GuildInvites",
    description: "Right-click a server to see all its invites in real time — the ones you created, the number of members you added, and every invite even if the inviter left the server.",
    authors: [{ name: "YouCord", id: 0n }],
    enabledByDefault: true,
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "guild-context": guildInvitesPatch,
        "guild-header-popout": guildInvitesPatch,
    },

    start() {
        FluxDispatcher.subscribe("INVITE_CREATE", onInviteFluxEvent);
        FluxDispatcher.subscribe("INVITE_DELETE", onInviteFluxEvent);
        FluxDispatcher.subscribe("GUILD_DELETE", onGuildFluxEvent);
    },

    stop() {
        FluxDispatcher.unsubscribe("INVITE_CREATE", onInviteFluxEvent);
        FluxDispatcher.unsubscribe("INVITE_DELETE", onInviteFluxEvent);
        FluxDispatcher.unsubscribe("GUILD_DELETE", onGuildFluxEvent);
        liveInvites.clear();
        cache.clear();
    },
});
