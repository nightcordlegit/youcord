/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, removeProfileBadge } from "@api/Badges";
import { beginDiscordOAuth, clearToken, getStoredToken, storeToken, YOUCORD_OAUTH_AVAILABLE } from "@api/OAuth2";
import definePlugin from "@utils/types";
import { Toasts, UserStore } from "@webpack/common";

import { createBillingPortalSession, createCheckoutSession, fetchPremiumStatus, waitForOAuthCompletion } from "./api";
import { settings } from "./settings";

const PREMIUM_BADGE_ICON = "https://raw.githubusercontent.com/nightcordlegit/youcord/main/icon.png";

let pollIntervalId: any;
let isPremiumCached = false;

/** Utilitaire réutilisable par d'autres plugins cosmétiques : `import { isPremium } from "@youcordplugins/premium";` */
export function isPremium() {
    return isPremiumCached;
}

const premiumBadge = {
    description: "YouCord Premium",
    iconSrc: PREMIUM_BADGE_ICON,
    position: BadgePosition.START,
    shouldShow: ({ userId }: { userId: string; }) => {
        return settings.store.showBadge && isPremiumCached && userId === UserStore.getCurrentUser()?.id;
    },
    props: {
        style: { borderRadius: "50%" }
    }
};

function openExternal(url: string) {
    VencordNative.native.openExternal(url);
}

async function refreshPremiumStatus(showToastOnUnlock = true) {
    const token = await getStoredToken();
    if (!token) return;

    const status = await fetchPremiumStatus();
    if (!status) return;

    const wasPremium = isPremiumCached;
    isPremiumCached = status.premium;

    if (!wasPremium && isPremiumCached && showToastOnUnlock) {
        Toasts.show({
            id: Toasts.genId(),
            message: "🎉 YouCord Premium débloqué ! Merci pour ton soutien.",
            type: Toasts.Type.SUCCESS
        });
    }
}

async function connectDiscordAccount(): Promise<boolean> {
    if (!YOUCORD_OAUTH_AVAILABLE) {
        Toasts.show({
            id: Toasts.genId(),
            message: "Le serveur YouCord Premium n'est pas encore configuré (API_BASE manquant).",
            type: Toasts.Type.FAILURE
        });
        return false;
    }

    const state = crypto.randomUUID();
    const signing = await beginDiscordOAuth(state).catch(() => null);
    if (!signing) {
        Toasts.show({ id: Toasts.genId(), message: "Impossible de contacter le serveur YouCord Premium.", type: Toasts.Type.FAILURE });
        return false;
    }

    openExternal(signing.url);
    Toasts.show({ id: Toasts.genId(), message: "Connecte-toi avec Discord dans la fenêtre qui vient de s'ouvrir...", type: Toasts.Type.MESSAGE });

    const result = await waitForOAuthCompletion(state);
    if (!result) {
        Toasts.show({ id: Toasts.genId(), message: "La connexion a expiré, réessaie.", type: Toasts.Type.FAILURE });
        return false;
    }

    await storeToken(result.sessionToken);
    Toasts.show({ id: Toasts.genId(), message: `Connecté en tant que ${result.username} !`, type: Toasts.Type.SUCCESS });
    return true;
}

async function subscribeFlow() {
    let token = await getStoredToken();
    if (!token) {
        const connected = await connectDiscordAccount();
        if (!connected) return;
    }

    const checkoutUrl = await createCheckoutSession();
    if (!checkoutUrl) {
        Toasts.show({ id: Toasts.genId(), message: "Impossible de créer la session de paiement. Réessaie plus tard.", type: Toasts.Type.FAILURE });
        return;
    }

    openExternal(checkoutUrl);
    Toasts.show({ id: Toasts.genId(), message: "Paiement ouvert dans ton navigateur. Le premium se débloque automatiquement après paiement.", type: Toasts.Type.MESSAGE });

    // Poll plus fréquemment pendant les minutes qui suivent l'ouverture du paiement
    // pour débloquer le badge/les cosmétiques dès la confirmation Stripe.
    let attempts = 0;
    const fastPoll = setInterval(async () => {
        attempts++;
        await refreshPremiumStatus();
        if (isPremiumCached || attempts > 40) clearInterval(fastPoll); // ~10 min max (40 * 15s)
    }, 15000);
}

async function manageSubscription() {
    const token = await getStoredToken();
    if (!token) {
        Toasts.show({ id: Toasts.genId(), message: "Connecte d'abord ton compte Discord (Devenir Premium).", type: Toasts.Type.FAILURE });
        return;
    }
    const portalUrl = await createBillingPortalSession();
    if (!portalUrl) {
        Toasts.show({ id: Toasts.genId(), message: "Aucun abonnement actif trouvé.", type: Toasts.Type.FAILURE });
        return;
    }
    openExternal(portalUrl);
}

export default definePlugin({
    name: "YouCordPremium",
    description: "Débloque les cosmétiques YouCord Premium après abonnement (Discord + Stripe)",
    authors: [{ name: "YouCord", id: 0n }],
    settings,
    enabledByDefault: true,

    async start() {
        addProfileBadge(premiumBadge);
        await refreshPremiumStatus(false);
        clearInterval(pollIntervalId);
        pollIntervalId = setInterval(() => refreshPremiumStatus(true), 10 * 60 * 1000);
    },

    stop() {
        removeProfileBadge(premiumBadge);
        clearInterval(pollIntervalId);
    },

    toolboxActions: {
        async "Devenir Premium"() {
            await subscribeFlow();
        },
        async "Vérifier mon statut Premium"() {
            await refreshPremiumStatus(false);
            Toasts.show({
                id: Toasts.genId(),
                message: isPremiumCached ? "Tu es Premium ✅" : "Pas encore Premium",
                type: isPremiumCached ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE
            });
        },
        async "Gérer mon abonnement"() {
            await manageSubscription();
        },
        async "Se déconnecter (Premium)"() {
            await clearToken();
            isPremiumCached = false;
            Toasts.show({ id: Toasts.genId(), message: "Déconnecté du compte YouCord Premium.", type: Toasts.Type.MESSAGE });
        }
    },

    // Permet a d'autres plugins cosmetiques de verifier le statut premium avant
    // d'activer un effet/asset exclusif. Deux facons de faire :
    //   1) import { isPremium } from "@youcordplugins/premium";
    //   2) Vencord.Plugins.plugins.YouCordPremium.isPremium()
    isPremium
});
