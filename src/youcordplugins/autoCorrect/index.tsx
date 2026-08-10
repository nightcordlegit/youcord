/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { showApiKeyWarning } from "@utils/apiKeyWarning";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

import plugins from "~plugins";

import { groqChat, hasAnyAIKey } from "../youcordAI/groqManager";

// ── Settings ───────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    isActive: {
        type: OptionType.BOOLEAN,
        description: "Enable automatic correction",
        default: false,
    },
    language: {
        type: OptionType.SELECT,
        description: "Correction language",
        options: [
            { label: "English", value: "en", default: true },
            { label: "French", value: "fr" },
            { label: "Spanish", value: "es" },
            { label: "German", value: "de" },
            { label: "Italian", value: "it" },
            { label: "Portuguese", value: "pt" },
        ],
    },
});

// ── Protected tokens (never sent to / touched by the model) ────────────────────
// Discord mentions, custom emojis, links and code spans are masked before the
// request and restored verbatim afterwards, so the model literally cannot
// alter them (no risk of it "translating" a mention or mangling a URL).

const PROTECTED_REGEXES: RegExp[] = [
    /<a?:\w+:\d+>/g, // custom emoji
    /<@!?\d+>/g, // user mention
    /<@&\d+>/g, // role mention
    /<#\d+>/g, // channel mention
    /https?:\/\/\S+/g, // links
    /```[\s\S]*?```/g, // code block
    /`[^`]+`/g, // inline code
];

// ── Slang / abbreviation whitelist ──────────────────────────────────────────────
// Words a human never actually "misspells" on purpose — internet/SMS shorthand
// that the model must leave completely untouched instead of "fixing" or
// expanding into a full sentence. Matched as whole words, case-insensitive.

const SLANG_WHITELIST = [
    // French — internet / SMS
    "mdr", "mdrr", "mdrrr", "mdrrrr", "ptdr", "xptdr", "jsp", "jss", "jpp", "wsh", "wesh",
    "tkt", "tqt", "dsl", "stp", "svp", "bcp", "cc", "slt", "bjr", "bsr", "bg", "gg", "ggwp",
    "wp", "ez", "rip", "osef", "askip", "chelou", "grv", "tavu", "tavue", "jtm", "jtmm",
    "bnj", "frr", "frerot", "frero", "reuf", "reufrere", "poto", "gow", "ptn", "ptnr",
    "cimer", "khey", "kheyou", "wallah", "wallahi", "oklm", "seum", "nrv", "relou",
    "chanmé", "chanme", "zbi", "wsp", "dac", "dacc", "auj", "tlm", "tt", "tjrs", "tjs",
    "pk", "pq", "qqn", "qqch", "jveux", "jve", "jvais", "chuis", "chui", "jsuis", "ct",
    "jpense", "jcrois", "biensur", "kikoo", "miskine", "askip", "carj", "nikel",
    // English — internet / Discord
    "lol", "lmao", "lmfao", "rofl", "omg", "wtf", "idk", "imo", "imho", "tbh", "btw",
    "afaik", "brb", "gtg", "irl", "fyi", "asap", "ngl", "icl", "tbf", "smh", "rn", "ily",
    "gl", "hf", "afk", "dm", "pm", "noob", "pog", "poggers", "kek", "cya", "ty", "yw",
    "np", "nvm", "ikr", "omw", "wyd", "hbu", "xd",
];

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SLANG_REGEX = new RegExp(`\\b(?:${SLANG_WHITELIST.map(escapeRegExp).join("|")})\\b`, "gi");

interface MaskResult {
    masked: string;
    map: Map<string, string>;
}

function maskProtectedTokens(text: string): MaskResult {
    const map = new Map<string, string>();
    let counter = 0;
    let masked = text;

    const mask = (match: string) => {
        const placeholder = `@@${counter++}@@`;
        map.set(placeholder, match);
        return placeholder;
    };

    for (const re of PROTECTED_REGEXES) masked = masked.replace(re, mask);
    masked = masked.replace(SLANG_REGEX, mask);

    return { masked, map };
}

function unmaskTokens(text: string, map: Map<string, string>): string {
    let result = text;
    for (const [placeholder, original] of map) result = result.split(placeholder).join(original);
    return result;
}

// ── Safety nets ──────────────────────────────────────────────────────────────
// Kept minimal on purpose: this is a "just correct it normally" plugin, not a
// strict word-for-word validator. We only guard against the two things that
// can actually go wrong with a small model: it refusing to answer, or it
// hallucinating an offensive word that wasn't in the original message.

function coreWord(w: string): string {
    return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

const SEVERE_TERMS = new Set([
    "viol", "violeur", "violeurs", "violeuse", "violer", "viole", "pedophile", "pedocriminel",
    "pute", "putes", "salope", "salopes", "negro", "negre", "bougnoule", "youpin", "pd", "tapette",
    "nazi", "hitler", "terroriste", "suicide", "suicider", "pendre", "pendaison", "nique", "niquer",
]);

function normalizeForSeverityCheck(w: string): string {
    return coreWord(w).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function introducesHallucinatedSevereTerm(original: string, corrected: string): boolean {
    const originalWords = new Set(original.trim().split(/\s+/).map(normalizeForSeverityCheck).filter(Boolean));
    const correctedWords = corrected.trim().split(/\s+/).map(normalizeForSeverityCheck).filter(Boolean);

    return correctedWords.some(w => SEVERE_TERMS.has(w) && !originalWords.has(w));
}

const REFUSAL_PATTERNS: RegExp[] = [
    /i['\u2019]m sorry/i,
    /i am sorry/i,
    /i cannot (help|assist|comply|do that|fulfill)/i,
    /i can['\u2019]t (help|assist|comply|do that|fulfill)/i,
    /i['\u2019]m (not able|unable) to/i,
    /i am (not able|unable) to/i,
    /as an ai( language model)?/i,
    /i won['\u2019]t (be able to |)help/i,
    /d[ée]sol[ée]e?,? je ne peux pas/i,
    /je ne peux pas (t['\u2019]|vous |)aider/i,
    /je ne suis pas en mesure/i,
    /en tant qu['\u2019]ia/i,
    /je ne peux pas (r[ée]pondre|traiter|corriger)/i,
];

function isRefusalResponse(text: string): boolean {
    return REFUSAL_PATTERNS.some(re => re.test(text));
}

// ── Correction via groqManager ────────────────────────────────────────────────

const PLACEHOLDER_RULE =
    "Certains mots ou groupes ont été remplacés par des jetons de la forme @@0@@, @@1@@, etc. " +
    "Ce sont des mentions, emojis, liens ou abréviations volontaires : recopie-les EXACTEMENT tels quels, " +
    "sans les modifier, les traduire ni les supprimer.\n" +
    "Some words were replaced by tokens like @@0@@, @@1@@, etc. " +
    "These are mentions, emojis, links, or intentional abbreviations: copy them back EXACTLY as-is, " +
    "never modify, translate, or remove them.";

const LANG_PROMPTS: Record<string, string> = {
    fr: "Tu es un correcteur orthographique et grammatical. Corrige les fautes d'orthographe, de grammaire, " +
        "de conjugaison et d'accord, ainsi que la ponctuation (virgules, points, points d'interrogation/" +
        "d'exclamation, apostrophes, majuscules de début de phrase) pour que le texte soit correct et lisible. " +
        "Ne change pas le sens du message, ne reformule pas les phrases déjà correctes, et ne remplace pas un " +
        "mot par un synonyme. Si le texte est déjà correct, retourne-le identique. Retourne UNIQUEMENT le " +
        "texte corrigé, sans guillemets ni explication.",
    en: "You are a spelling and grammar checker. Fix spelling, grammar, conjugation and agreement mistakes, " +
        "as well as punctuation (commas, periods, question/exclamation marks, apostrophes, sentence-starting " +
        "capital letters) so the text reads correctly. Don't change the meaning of the message, don't reword " +
        "sentences that are already correct, and don't swap a word for a synonym. If the text is already " +
        "correct, return it as-is. Return ONLY the corrected text, without quotes or explanation.",
    es: "Eres un corrector ortográfico y gramatical. Corrige errores de ortografía, gramática, conjugación y " +
        "concordancia, así como la puntuación (comas, puntos, signos de interrogación/exclamación, apóstrofes, " +
        "mayúsculas al inicio de frase). No cambies el sentido del mensaje ni reformules frases ya correctas. " +
        "Devuelve SOLO el texto corregido, sin comillas ni explicación.",
    de: "Du bist ein Rechtschreib- und Grammatikprüfer. Korrigiere Rechtschreib-, Grammatik-, Konjugations- und " +
        "Kongruenzfehler sowie die Zeichensetzung (Kommas, Punkte, Frage-/Ausrufezeichen, Apostrophe, " +
        "Großschreibung am Satzanfang). Ändere nicht die Bedeutung und formuliere bereits korrekte Sätze nicht " +
        "um. Gib NUR den korrigierten Text zurück, ohne Anführungszeichen oder Erklärung.",
    it: "Sei un correttore ortografico e grammaticale. Correggi errori di ortografia, grammatica, coniugazione e " +
        "concordanza, oltre alla punteggiatura (virgole, punti, punti interrogativi/esclamativi, apostrofi, " +
        "maiuscole a inizio frase). Non cambiare il significato né riformulare frasi già corrette. Restituisci " +
        "SOLO il testo corretto, senza virgolette né spiegazioni.",
    pt: "Você é um corretor ortográfico e gramatical. Corrija erros de ortografia, gramática, conjugação e " +
        "concordância, além da pontuação (vírgulas, pontos, pontos de interrogação/exclamação, apóstrofos, " +
        "maiúsculas no início da frase). Não mude o sentido da mensagem nem reformule frases já corretas. " +
        "Retorne APENAS o texto corrigido, sem aspas ou explicação.",
};

async function correctText(text: string): Promise<string> {
    if (text.trim().length < 3) return text;

    const lang = settings.store.language ?? "en";
    const systemPrompt = (LANG_PROMPTS[lang] ?? LANG_PROMPTS.en) + "\n\n" + PLACEHOLDER_RULE;

    const { masked, map } = maskProtectedTokens(text);

    try {
        const correctedMasked = await groqChat({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: masked },
            ],
            temperature: 0,
            maxTokens: 512,
            // Forcer un modèle léger pour la correction — économise le quota du 120B pour l'IA
            forceModel: "openai/gpt-oss-20b",
        });

        if (!correctedMasked || correctedMasked.trim() === "") return text;

        // Le modèle a refusé de traiter le message (garde-fou interne à Groq) —
        // ce refus n'est pas une correction, on garde le texte original.
        if (isRefusalResponse(correctedMasked)) {
            console.warn("[AutoCorrect] Rejected: model refused instead of correcting", { text, response: correctedMasked });
            return text;
        }

        const corrected = unmaskTokens(correctedMasked, map).replace(/^"(.*)"$/, "$1").trim();

        if (corrected === text) return text;

        // Sécurité contre les répétitions infinies ou les hallucinations
        if (corrected.toLowerCase().includes("correction:") || corrected.toLowerCase().includes("text:")) return text;

        // Sécurité : réponse trop différente en longueur → on n'applique pas
        if (corrected.length > text.length * 1.6 || corrected.length < text.length * 0.4) return text;

        // Filet de sécurité absolu : jamais de mot sensible/offensant halluciné,
        // même si le reste de la correction semblait raisonnable.
        if (introducesHallucinatedSevereTerm(text, corrected)) {
            console.warn("[AutoCorrect] Rejected: correction introduced a sensitive term absent from the original", { text, corrected });
            return text;
        }

        return corrected;
    } catch (e: any) {
        console.warn("[AutoCorrect] Error correction:", e.message);
        return text; // En cas d'error, envoyer le texte original
    }
}

// ── Chat Bar Button ────────────────────────────────────────────────────────────

function AutoCorrectIcon({ enabled }: { enabled: boolean; }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="currentColor"
                d="M8.87 2.31A.5.5 0 0 1 9.34 2h10.92c.36 0 .6.36.47.69l-.6 1.5a.5.5 0 0 1-.47.31h-4.28l-4.17 15h4.05c.36 0 .6.36.47.69l-.6 1.5a.5.5 0 0 1-.47.31H3.74a.5.5 0 0 1-.47-.69l.6-1.5a.5.5 0 0 1 .47-.31h4.28l4.17-15H8.74a.5.5 0 0 1-.47-.69l.6-1.5Z"
                opacity={enabled ? 1 : 0.35}
            />
            {!enabled && (
                <path
                    fill="var(--status-danger)"
                    d="M21.178 1.707 22.592 3.12 4.12 21.593l-1.414-1.415L21.178 1.707Z"
                />
            )}
        </svg>
    );
}

const AutoCorrectChatBarButton: ChatBarButtonFactory = ({ type }) => {
    const [enabled, setEnabled] = React.useState(settings.store.isActive);
    const validChat = ["normal", "sidebar"].some(x => type.analyticsName === x);
    if (!validChat) return null;

    const toggle = async () => {
        if (!enabled) {
            // Vérifie que la clé API est configurée avant d'activer
            const key = await hasAnyAIKey();
            if (!key) {
                showApiKeyWarning("AutoCorrect");
                return;
            }
        }
        settings.store.isActive = !settings.store.isActive;

        setEnabled(settings.store.isActive);
    };

    const tooltip = enabled
        ? "AutoCorrect: enabled — click to disable"
        : "AutoCorrect: disabled — click to enable";

    return (
        <ChatBarButton
            tooltip={tooltip}
            onClick={toggle}
            onContextMenu={e => {
                e.preventDefault();
                openPluginModal(plugins.AutoCorrect ?? plugins.autoCorrect);
            }}
        >
            <AutoCorrectIcon enabled={enabled} />
        </ChatBarButton>
    );
};

// ── Plugin ─────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "AutoCorrect",
    enabledByDefault: true,
    description: "Automatically corrects spelling, grammar and punctuation before sending. Requires a free Groq API key configured in YouCordAI.",
    authors: [{ name: "YouCord", id: 0n }],
    settings,

    start() { },

    chatBarButton: {
        icon: () => <AutoCorrectIcon enabled={settings.store.isActive} />,
        render: AutoCorrectChatBarButton,
    },

    async onBeforeMessageSend(_channelId: string, message: { content: string; }) {
        if (!settings.store.isActive) return;
        if (!message.content || message.content.trim().length < 3) return;

        const corrected = await correctText(message.content);
        if (corrected && corrected !== message.content) {
            message.content = corrected;
        }
    },
});
