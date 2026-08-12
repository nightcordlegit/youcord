/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { insertTextIntoChatInputBox, sendMessage } from "@utils/discord";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";

type ReminderKind =
    | "speech"
    | "anger"
    | "mockery"
    | "gentleness"
    | "backbiting"
    | "honesty"
    | "justice"
    | "brotherhood"
    | "prayer"
    | "repentance"
    | "parents"
    | "patience"
    | "charity"
    | "modesty"
    | "intention"
    | "intoxicants"
    | "gambling"
    | "chastity"
    | "wealth"
    | "humility";

interface Reminder {
    id: string;
    kind: ReminderKind;
    category: string;
    title: string;
    quote: string;
    reference: string;
    reflection: string;
}

const reminders: Reminder[] = [
    {
        id: "quran-49-11",
        kind: "mockery",
        category: "Parole et comportement",
        title: "Préserver la dignité de chacun",
        quote: "Ne vous dénigrez pas et ne vous lancez pas mutuellement des sobriquets injurieux.",
        reference: "Coran — sourate Al-Hujurât, 49:11",
        reflection: "Nos mots laissent parfois des traces plus profondes qu'on ne l'imagine. Gardons une parole digne, même lorsque le désaccord est fort."
    },
    {
        id: "quran-41-34",
        kind: "gentleness",
        category: "Bon comportement",
        title: "Répondre de la meilleure manière",
        quote: "Repousse le mal par ce qui est meilleur.",
        reference: "Coran — sourate Fussilat, 41:34",
        reflection: "Répondre avec sagesse n'est pas une faiblesse : c'est refuser que la colère décide à notre place et donner une chance à l'apaisement."
    },
    {
        id: "quran-3-134",
        kind: "anger",
        category: "Maîtrise de soi",
        title: "Maîtriser sa colère",
        quote: "Ceux qui dominent leur rage et pardonnent à autrui.",
        reference: "Coran — sourate Âl-'Imrân, 3:134",
        reflection: "La vraie victoire n'est pas d'écraser l'autre, mais de rester juste quand la colère monte. Prenons un instant avant de répondre."
    },
    {
        id: "bukhari-6018",
        kind: "speech",
        category: "Parole",
        title: "Dire du bien ou garder le silence",
        quote: "Que celui qui croit en Allah et au Jour dernier dise du bien ou qu'il se taise.",
        reference: "Sahih al-Bukhari 6018",
        reflection: "Une parole utile peut réparer ; une parole lancée sous la colère peut blesser longtemps. Choisissons ce qui rapproche plutôt que ce qui divise."
    },
    {
        id: "bukhari-6114",
        kind: "anger",
        category: "Maîtrise de soi",
        title: "La véritable force",
        quote: "Le fort est celui qui se maîtrise lorsqu'il est en colère.",
        reference: "Sahih al-Bukhari 6114",
        reflection: "Se retenir au moment où l'on pourrait blesser demande plus de force que de répondre immédiatement. La maîtrise de soi protège tout le monde."
    },
    {
        id: "muslim-2594a",
        kind: "gentleness",
        category: "Bon comportement",
        title: "La douceur embellit les échanges",
        quote: "La douceur n'est présente dans une chose sans l'embellir.",
        reference: "Sahih Muslim 2594a",
        reflection: "Même une vérité devient difficile à entendre lorsqu'elle est dite avec dureté. La douceur permet de conseiller sans humilier."
    },
    {
        id: "quran-49-12",
        kind: "backbiting",
        category: "Parole et comportement",
        title: "Éviter la médisance",
        quote: "Ne médisez pas les uns des autres.",
        reference: "Coran — sourate Al-Hujurât, 49:12",
        reflection: "Parler d'une personne en son absence peut abîmer son honneur et nourrir les conflits. Préservons la dignité des autres comme nous aimerions préserver la nôtre."
    },
    {
        id: "quran-29-45",
        kind: "prayer",
        category: "Prière",
        title: "Préserver la prière",
        quote: "Accomplis la prière. La prière préserve de la turpitude et du blâmable.",
        reference: "Coran — sourate Al-'Ankabût, 29:45",
        reflection: "La prière n'est pas seulement un rendez-vous : elle recentre le cœur et nous aide à nous éloigner de ce qui déplaît à Allah. Revenons-y avec sincérité et constance."
    },
    {
        id: "quran-39-53",
        kind: "repentance",
        category: "Repentir et espérance",
        title: "Ne jamais désespérer de la miséricorde",
        quote: "Ne désespérez pas de la miséricorde d'Allah.",
        reference: "Coran — sourate Az-Zumar, 39:53",
        reflection: "Une faute ne ferme pas la porte du retour. Reconnaître, regretter, cesser et revenir sincèrement vers Allah est toujours meilleur que s'enfoncer dans le désespoir."
    },
    {
        id: "quran-17-23",
        kind: "parents",
        category: "Parents et famille",
        title: "Honorer ses parents",
        quote: "Ne leur dis même pas : “Fi !” et adresse-leur des paroles respectueuses.",
        reference: "Coran — sourate Al-Isrâ', 17:23",
        reflection: "La piété se voit aussi dans la patience, la douceur et le respect envers les parents. Une parole noble peut être une immense adoration."
    },
    {
        id: "quran-2-153",
        kind: "patience",
        category: "Épreuves et patience",
        title: "Chercher secours dans la patience",
        quote: "Cherchez secours dans la patience et la prière. Allah est avec les patients.",
        reference: "Coran — sourate Al-Baqarah, 2:153",
        reflection: "Dans l'épreuve, ralentissons avant d'agir. La patience n'est pas l'inaction : c'est rester attaché au bien tout en demandant l'aide d'Allah."
    },
    {
        id: "quran-2-261",
        kind: "charity",
        category: "Aumône et générosité",
        title: "Donner sincèrement",
        quote: "Ceux qui dépensent leurs biens dans le sentier d'Allah ressemblent à un grain qui produit sept épis.",
        reference: "Coran — sourate Al-Baqarah, 2:261",
        reflection: "Même un petit don fait sincèrement peut porter beaucoup de bien. La générosité comprend aussi le temps, l'attention, l'aide et la bonne parole."
    },
    {
        id: "quran-49-10",
        kind: "brotherhood",
        category: "Fraternité",
        title: "Réconcilier plutôt que diviser",
        quote: "Les croyants ne sont que des frères. Établissez la concorde entre vos frères.",
        reference: "Coran — sourate Al-Hujurât, 49:10",
        reflection: "Lorsque la tension monte, cherchons la justice et l'apaisement plutôt que les clans et l'humiliation. Réparer un lien est meilleur que nourrir une dispute."
    },
    {
        id: "quran-33-70",
        kind: "honesty",
        category: "Vérité et sincérité",
        title: "Prononcer une parole juste",
        quote: "Craignez Allah et parlez avec droiture.",
        reference: "Coran — sourate Al-Ahzâb, 33:70",
        reflection: "La sincérité demande de vérifier avant d'affirmer, de reconnaître ses erreurs et de ne pas déformer les faits pour gagner une dispute."
    },
    {
        id: "quran-5-8",
        kind: "justice",
        category: "Justice",
        title: "Rester juste même dans le désaccord",
        quote: "Que la haine pour un peuple ne vous incite pas à être injustes. Soyez justes.",
        reference: "Coran — sourate Al-Mâ'idah, 5:8",
        reflection: "La colère contre quelqu'un ne rend pas l'injustice permise. Écoutons, vérifions et jugeons les actes avec équité, sans généraliser ni humilier."
    },
    {
        id: "quran-24-30",
        kind: "modesty",
        category: "Pudeur",
        title: "Préserver le regard et la pudeur",
        quote: "Dis aux croyants de baisser leurs regards et de garder leur chasteté.",
        reference: "Coran — sourate An-Nûr, 24:30",
        reflection: "La pudeur commence dans le regard, l'intention et le respect d'autrui. Elle protège le cœur et rappelle que chaque personne possède une dignité."
    },
    {
        id: "bukhari-1",
        kind: "intention",
        category: "Intention",
        title: "Renouveler son intention",
        quote: "Les actes ne valent que par les intentions.",
        reference: "Sahih al-Bukhari 1",
        reflection: "Avant de parler, publier ou conseiller, demandons-nous pourquoi nous le faisons. Une bonne action gagne en valeur lorsqu'elle vise sincèrement l'agrément d'Allah."
    },
    {
        id: "muslim-55a",
        kind: "brotherhood",
        category: "Conseil sincère",
        title: "Conseiller avec sincérité",
        quote: "La religion, c'est le conseil sincère.",
        reference: "Sahih Muslim 55a",
        reflection: "Un conseil utile cherche le bien de l'autre : il repose sur la connaissance, la douceur, le bon moment et l'absence d'humiliation publique."
    },
    {
        id: "bukhari-10",
        kind: "speech",
        category: "Sécurité et fraternité",
        title: "Ne pas nuire par la langue ou la main",
        quote: "Le musulman est celui dont les musulmans sont à l'abri de sa langue et de sa main.",
        reference: "Sahih al-Bukhari 10",
        reflection: "La piété ne se limite pas aux paroles : elle se manifeste lorsque les autres sont protégés de nos insultes, de nos menaces et de nos injustices."
    },
    {
        id: "quran-5-90-intoxicants",
        kind: "intoxicants",
        category: "Alcool et drogues",
        title: "S'éloigner de ce qui altère l'esprit",
        quote: "Le vin, le jeu de hasard, les pierres dressées et les flèches divinatoires ne sont qu'une abomination parmi les œuvres du Diable. Écartez-vous-en.",
        reference: "Coran — sourate Al-Mâ'idah, 5:90",
        reflection: "Protéger sa raison et son corps fait partie des responsabilités du croyant. Si une habitude est devenue difficile à quitter, demander de l'aide est une force et non une honte."
    },
    {
        id: "quran-5-90-gambling",
        kind: "gambling",
        category: "Jeux d'argent",
        title: "Préserver ses biens du jeu",
        quote: "Le vin et le jeu de hasard ne sont qu'une abomination parmi les œuvres du Diable. Écartez-vous-en afin que vous réussissiez.",
        reference: "Coran — sourate Al-Mâ'idah, 5:90",
        reflection: "Le pari promet un gain rapide mais expose les biens, les relations et le cœur à de lourdes pertes. Cherchons un revenu licite et une voie qui ne repose pas sur le hasard."
    },
    {
        id: "quran-17-32",
        kind: "chastity",
        category: "Chasteté et pudeur",
        title: "Ne pas s'approcher de la turpitude",
        quote: "N'approchez pas de la fornication. C'est une turpitude, et quel mauvais chemin !",
        reference: "Coran — sourate Al-Isrâ', 17:32",
        reflection: "La pudeur protège la dignité, l'intimité et le consentement. Évitons aussi les messages, images et invitations qui conduisent vers ce qui blesse le cœur ou autrui."
    },
    {
        id: "quran-2-188",
        kind: "wealth",
        category: "Biens et honnêteté",
        title: "Ne pas prendre les biens injustement",
        quote: "Ne dévorez pas mutuellement vos biens par des moyens illicites.",
        reference: "Coran — sourate Al-Baqarah, 2:188",
        reflection: "Le vol, l'arnaque, la corruption et la tromperie privent autrui de son droit. La réparation commence par l'arrêt du tort, la restitution et un repentir sincère."
    },
    {
        id: "quran-31-18",
        kind: "humility",
        category: "Humilité",
        title: "Refuser l'orgueil et le mépris",
        quote: "Ne détourne pas ton visage des hommes par orgueil et ne foule pas la terre avec arrogance.",
        reference: "Coran — sourate Luqmân, 31:18",
        reflection: "La valeur d'une personne ne grandit pas en rabaissant les autres. L'humilité permet de reconnaître ses limites, d'écouter et de corriger ses erreurs."
    },
    {
        id: "quran-17-27",
        kind: "wealth",
        category: "Modération",
        title: "Éviter le gaspillage",
        quote: "Les gaspilleurs sont les frères des diables.",
        reference: "Coran — sourate Al-Isrâ', 17:27",
        reflection: "La modération concerne l'argent, la nourriture, le temps et les ressources. Profitons des bienfaits sans excès et partageons ce qui peut être utile."
    }
];

const settings = definePluginSettings({
    onlyOnDetectedInsults: {
        type: OptionType.BOOLEAN,
        description: "Afficher le bouton uniquement sur les comportements explicitement détectés",
        default: true,
        restartNeeded: false
    },
    adaptiveReminder: {
        type: OptionType.BOOLEAN,
        description: "Choisir un rappel adapté au comportement détecté",
        default: true,
        restartNeeded: false
    },
    autoSend: {
        type: OptionType.BOOLEAN,
        description: "Envoyer automatiquement un rappel après un comportement explicite détecté",
        default: true,
        restartNeeded: false
    },
    autoCooldownSeconds: {
        type: OptionType.SLIDER,
        description: "Délai automatique par personne et par salon pour éviter les réponses répétitives",
        markers: [30, 60, 120, 300, 600],
        default: 120,
        restartNeeded: false
    },
    pingOnReply: {
        type: OptionType.BOOLEAN,
        description: "Mentionner l'auteur du message dans la réponse",
        default: false,
        restartNeeded: false
    },
    cooldownSeconds: {
        type: OptionType.SLIDER,
        description: "Délai minimum entre deux rappels pour éviter le spam",
        markers: [3, 5, 10, 20, 30],
        default: 5,
        restartNeeded: false
    }
});

const insultWords = /\b(?:abruti|abrutie|batard|batarde|bouffon|bouffonne|clochard|clocharde|con|conne|connard|connarde|connasse|debile|fdp|idiot|idiote|merde|ntm|pute|salope|salaud|salaude|tg)\b/i;
const insultPhrases = /\b(?:ferme\s+ta\s+gueule|fils\s+de\s+pute|nique\s+ta\s+mere|va\s+te\s+faire\s+foutre)\b/i;
const threatPhrases = /\b(?:je\s+vais\s+te\s+(?:tuer|frapper)|je\s+te\s+(?:tue|frappe)|va\s+crever|cr[eè]ve|tu\s+vas\s+crever|menace\s+de\s+(?:mort|violence))\b/i;
const mockeryWords = /\b(?:honteux|minable|ridicule|incapable|inutile|pathétique)\b/i;
const backbitingWords = /\b(?:medisance|medire|ragot|rumeur|derriere\s+son\s+dos|parle\s+sur\s+lui|parle\s+sur\s+elle)\b/i;
const admittedLiePhrases = /\b(?:je\s+mens|j[' ]?ai\s+menti|je\s+vais\s+mentir|j[' ]?invente\s+(?:une|des)\s+(?:histoire|rumeur|mensonge))\b/i;
const discriminatoryInsults = /\b(?:sale|espece\s+de)\s+(?:arabe|asiatique|blanc|chretien|handicape|juif|musulman|noir|rom|roumain)\b/i;
const intoxicantIntentPhrases = /\b(?:(?:je|on)\s+(?:vais|va|veux|veut|compte)\s+(?:me\s+)?(?:bourrer|saouler|droguer)|(?:viens?|venez)\s+(?:boire|se\s+bourrer|fumer\s+(?:du\s+)?(?:shit|cannabis))|(?:ramene|ramenez|achete|achetez)\s+(?:de\s+l?\s*)?(?:alcool|vodka|drogue|cocaine|shit|cannabis))\b/i;
const gamblingIntentPhrases = /\b(?:(?:je|on)\s+(?:vais|va|veux|veut)\s+(?:miser|parier|jouer\s+de\s+l?\s*argent)|(?:viens?|venez)\s+(?:au\s+casino|parier|miser)|(?:mise|parie|mets?)\s+(?:\d+|tout)\s*(?:euros?|balles?)\s+sur)\b/i;
const sexualSolicitationPhrases = /\b(?:(?:envoie|envoyez|partage|partagez)\s+(?:(?:moi|nous)\s+)?(?:un|des|ton|ta|tes)?\s*(?:nude|nudes|photo\s+nue|photos\s+nues|porno)|(?:viens?|venez)\s+(?:baiser|coucher\s+avec\s+moi)|(?:regarde|regardez|partage|partagez)\s+(?:du|ce)\s+porno)\b/i;
const dishonestWealthPhrases = /\b(?:(?:je|on)\s+(?:vais|va|veux|veut)\s+(?:le\s+|la\s+|les\s+)?(?:voler|arnaquer)|j\s*ai\s+(?:vole|arnaque)|(?:arnaque|arnaquez|vole|volez)\s+(?:le|la|les|un|une)|(?:paye|payez|donne|donnez)\s+un\s+pot\s+de\s+vin)\b/i;
const arrogantBoastingPhrases = /\b(?:je\s+suis\s+(?:bien\s+)?meilleur\s+que\s+(?:toi|vous|eux|elle|lui)|vous\s+etes\s+tous\s+inferieurs|personne\s+ne\s+m\s*arrive\s+a\s+la\s+cheville)\b/i;

const recentlySent = new Map<string, number>();
const processedAutoMessages = new Set<string>();
const reminderDecks = new Map<string, string[]>();
const lastReminderByDeck = new Map<string, string>();

const compatibleReminderKinds: Record<ReminderKind, ReminderKind[]> = {
    speech: ["speech", "gentleness", "intention", "brotherhood"],
    anger: ["anger", "gentleness", "speech", "patience"],
    mockery: ["mockery", "speech", "gentleness", "brotherhood"],
    gentleness: ["gentleness", "speech", "anger", "brotherhood"],
    backbiting: ["backbiting", "speech", "honesty", "brotherhood"],
    honesty: ["honesty", "speech", "intention", "wealth"],
    justice: ["justice", "gentleness", "brotherhood", "speech"],
    brotherhood: ["brotherhood", "gentleness", "speech", "justice"],
    prayer: ["prayer", "patience", "repentance", "intention"],
    repentance: ["repentance", "intention", "patience", "prayer"],
    parents: ["parents", "gentleness", "patience", "speech"],
    patience: ["patience", "prayer", "gentleness", "repentance"],
    charity: ["charity", "wealth", "intention", "brotherhood"],
    modesty: ["modesty", "chastity", "intention", "repentance"],
    intention: ["intention", "repentance", "speech", "prayer"],
    intoxicants: ["intoxicants", "repentance", "intention", "patience"],
    gambling: ["gambling", "wealth", "repentance", "intention"],
    chastity: ["chastity", "modesty", "intention", "repentance"],
    wealth: ["wealth", "honesty", "intention", "repentance"],
    humility: ["humility", "gentleness", "brotherhood", "intention"]
};

function normalizeForDetection(content: string) {
    return content
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[@4]/g, "a")
        .replace(/[€3]/g, "e")
        .replace(/[!1]/g, "i")
        .replace(/0/g, "o")
        .replace(/\$/g, "s")
        .replace(/([a-z])[^a-z0-9\s]+(?=[a-z])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

function classifyMessage(content: string): ReminderKind | null {
    const normalized = normalizeForDetection(content);
    if (!normalized) return null;
    if (sexualSolicitationPhrases.test(normalized)) return "chastity";
    if (dishonestWealthPhrases.test(normalized)) return "wealth";
    if (gamblingIntentPhrases.test(normalized)) return "gambling";
    if (intoxicantIntentPhrases.test(normalized)) return "intoxicants";
    if (arrogantBoastingPhrases.test(normalized)) return "humility";
    if (discriminatoryInsults.test(normalized)) return "justice";
    if (insultPhrases.test(normalized) || insultWords.test(normalized)) return "mockery";
    if (threatPhrases.test(normalized)) return "anger";
    if (backbitingWords.test(normalized)) return "backbiting";
    if (admittedLiePhrases.test(normalized)) return "honesty";
    if (mockeryWords.test(normalized)) return "gentleness";
    return null;
}

function selectReminder(message: Message): Reminder {
    const detectedKind = classifyMessage(message.content ?? "");
    const relevantKinds = detectedKind ? compatibleReminderKinds[detectedKind] : [];
    const relevantPool = settings.store.adaptiveReminder && relevantKinds.length
        ? reminders.filter(reminder => relevantKinds.includes(reminder.kind))
        : reminders;
    const deckKey = `${message.channel_id}:${settings.store.adaptiveReminder ? detectedKind ?? "general" : "all"}`;
    const validIds = new Set(relevantPool.map(reminder => reminder.id));
    let deck = (reminderDecks.get(deckKey) ?? []).filter(id => validIds.has(id));

    if (!deck.length) {
        deck = relevantPool.map(reminder => reminder.id);
        for (let index = deck.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
        }

        const previousId = lastReminderByDeck.get(deckKey);
        if (deck.length > 1 && deck.at(-1) === previousId) {
            [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
        }
    }

    const selectedId = deck.pop() ?? relevantPool[0].id;
    reminderDecks.set(deckKey, deck);
    lastReminderByDeck.set(deckKey, selectedId);
    return relevantPool.find(reminder => reminder.id === selectedId) ?? relevantPool[0];
}

function formatReminder(reminder: Reminder) {
    return [
        `🌙 **Rappel bienveillant — ${reminder.title}**`,
        "",
        `> « ${reminder.quote} »`,
        `> — **${reminder.reference}**`,
        "",
        reminder.reflection,
        "",
        "_Ce rappel s'adresse à nous tous, sans jugement. Qu'Allah nous accorde une parole juste et apaisante._"
    ].join("\n").trim();
}

function canSendInChannel(message: Message) {
    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return false;
    return !channel.guild_id || PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel);
}

async function sendReminder(message: Message, reminder = selectReminder(message), automated = false) {
    if (!canSendInChannel(message)) {
        if (!automated) showToast("Vous ne pouvez pas envoyer de message dans ce salon.", Toasts.Type.FAILURE);
        return;
    }

    const now = Date.now();
    const cooldown = automated
        ? Math.max(30, settings.store.autoCooldownSeconds ?? 120) * 1000
        : Math.max(3, settings.store.cooldownSeconds ?? 5) * 1000;
    const cooldownKey = automated
        ? `auto:${message.channel_id}:${message.author?.id ?? "unknown"}`
        : `manual:${message.channel_id}`;
    const lastSent = recentlySent.get(cooldownKey) ?? 0;
    if (now - lastSent < cooldown) {
        if (!automated) showToast("Patientez quelques secondes avant d'envoyer un autre rappel.", Toasts.Type.MESSAGE);
        return;
    }

    recentlySent.set(cooldownKey, now);
    try {
        await sendMessage(message.channel_id, { content: formatReminder(reminder) }, true, {
            allowedMentions: {
                parse: [],
                replied_user: automated ? false : settings.store.pingOnReply
            },
            messageReference: {
                channel_id: message.channel_id,
                message_id: message.id,
                guild_id: (message as any).guild_id
            }
        });
        if (!automated) showToast("Rappel envoyé avec bienveillance.", Toasts.Type.SUCCESS);
    } catch (error) {
        recentlySent.delete(cooldownKey);
        console.error("[RappelIslamique] Échec de l'envoi", error);
        if (!automated) showToast("Impossible d'envoyer le rappel.", Toasts.Type.FAILURE);
    }
}

function CrescentIcon({ active, height = 20, width = 20, className }: { active?: boolean; height?: number | string; width?: number | string; className?: string; }) {
    return (
        <svg
            className={className}
            width={width}
            height={height}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ color: active ? "var(--status-positive, #23a55a)" : undefined }}
        >
            <path fill="currentColor" d="M19.4 15.2A7.8 7.8 0 0 1 8.8 4.6a8.7 8.7 0 1 0 10.6 10.6Z" />
            <path fill="currentColor" d="m17.5 3 .65 1.85L20 5.5l-1.85.65L17.5 8l-.65-1.85L15 5.5l1.85-.65L17.5 3Z" />
        </svg>
    );
}

function ReminderLibraryModal({ rootProps }: { rootProps: any; }) {
    const insertReminder = (reminder: Reminder) => {
        insertTextIntoChatInputBox(formatReminder(reminder));
        rootProps.onClose();
        showToast("Rappel ajouté dans la zone de saisie.", Toasts.Type.SUCCESS);
    };

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader separator={false} className="yc-ir-header">
                <div className="yc-ir-title-wrap">
                    <CrescentIcon width={24} height={24} />
                    <div>
                        <h2>Rappels islamiques</h2>
                        <div className="yc-ir-subtitle">Choisissez un rappel à relire et à envoyer avec sagesse.</div>
                    </div>
                </div>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent className="yc-ir-content">
                <div className="yc-ir-notice">Les textes et la détection restent en local. L'envoi automatique respecte un délai anti-spam et ne mentionne personne.</div>
                <div className="yc-ir-list">
                    {reminders.map(reminder => (
                        <button className="yc-ir-card" key={reminder.id} onClick={() => insertReminder(reminder)}>
                            <span className="yc-ir-card-category">{reminder.category}</span>
                            <span className="yc-ir-card-title">{reminder.title}</span>
                            <span className="yc-ir-card-quote">« {reminder.quote} »</span>
                            <span className="yc-ir-card-reference">{reminder.reference}</span>
                            <span className="yc-ir-card-action">Ajouter au message</span>
                        </button>
                    ))}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

const ReminderChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { autoSend } = settings.use(["autoSend"]);
    if (!isMainChat) return null;

    const toggleAutomaticReminders = () => {
        settings.store.autoSend = !autoSend;
        showToast(
            settings.store.autoSend ? "Rappels automatiques activés." : "Rappels automatiques désactivés.",
            settings.store.autoSend ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE
        );
    };

    return (
        <ChatBarButton
            tooltip={autoSend
                ? "Rappels automatiques activés — cliquez pour désactiver"
                : "Rappels automatiques désactivés — cliquez pour activer"}
            onClick={toggleAutomaticReminders}
            onContextMenu={event => {
                event.preventDefault();
                openModal(rootProps => <ReminderLibraryModal rootProps={rootProps} />);
            }}
            buttonProps={{
                "aria-pressed": autoSend,
                "aria-label": autoSend ? "Désactiver les rappels automatiques" : "Activer les rappels automatiques"
            }}
        >
            <CrescentIcon active={autoSend} />
        </ChatBarButton>
    );
};

function shouldOfferReminder(message?: Message) {
    if (!message?.content || !canSendInChannel(message)) return false;
    return !settings.store.onlyOnDetectedInsults || classifyMessage(message.content) !== null;
}

const messageContextPatch: NavContextMenuPatchCallback = (children, props: { message?: Message; msg?: Message; }) => {
    const message = props.message ?? props.msg;
    if (!shouldOfferReminder(message)) return;
    const group = findGroupChildrenByChildId("reply", children) ?? findGroupChildrenByChildId("copy-text", children);
    if (!group || !message) return;
    const position = Math.max(0, group.findIndex(item => item?.props?.id === "reply") + 1);
    group.splice(position, 0, (
        <Menu.MenuItem
            id="yc-islamic-reminder"
            label="Envoyer un rappel bienveillant"
            icon={CrescentIcon}
            action={() => sendReminder(message)}
        />
    ));
};

export default definePlugin({
    name: "RappelIslamique",
    description: "Propose des rappels islamiques sourcés et adaptés aux comportements explicites détectés.",
    authors: [{ name: "YouCord", id: 0n }],
    enabledByDefault: true,
    dependencies: ["ChatInputButtonAPI", "MessagePopoverAPI"],
    settings,

    contextMenus: {
        message: messageContextPatch
    },

    chatBarButton: {
        icon: CrescentIcon,
        render: ReminderChatBarButton
    },

    messagePopoverButton: {
        icon: CrescentIcon,
        render(message: Message) {
            if (!shouldOfferReminder(message)) return null;
            return {
                label: "Envoyer un rappel bienveillant",
                icon: CrescentIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => sendReminder(message)
            };
        }
    },

    flux: {
        async MESSAGE_CREATE({ message, optimistic }: { message: Message; optimistic?: boolean; }) {
            if (!settings.store.autoSend || optimistic || !message?.id || !message.content) return;
            if (message.channel_id !== SelectedChannelStore.getChannelId()) return;
            if (processedAutoMessages.has(message.id)) return;
            if (message.author?.bot || message.author?.id === UserStore.getCurrentUser()?.id) return;
            if (!classifyMessage(message.content)) return;

            processedAutoMessages.add(message.id);
            if (processedAutoMessages.size > 500) {
                const oldest = processedAutoMessages.values().next().value;
                if (oldest) processedAutoMessages.delete(oldest);
            }

            await sendReminder(message, selectReminder(message), true);
        }
    }
});
