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
    // French profanity / insult abbreviations — keep the user's exact wording
    "clc", "ftg", "tg", "ntm", "fdp", "fdb",
    // English — internet / Discord
    "lol", "lmao", "lmfao", "rofl", "omg", "wtf", "idk", "imo", "imho", "tbh", "btw",
    "afaik", "brb", "gtg", "irl", "fyi", "asap", "ngl", "icl", "tbf", "smh", "rn", "ily",
    "gl", "hf", "afk", "dm", "pm", "noob", "pog", "poggers", "kek", "cya", "ty", "yw",
    "np", "nvm", "ikr", "omw", "wyd", "hbu", "xd",
];

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const INTENTIONAL_TOKEN_REGEX = new RegExp(
    `\\b(?:${SLANG_WHITELIST.map(escapeRegExp).join("|")})\\b`,
    "gi"
);

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
    masked = masked.replace(INTENTIONAL_TOKEN_REGEX, mask);

    return { masked, map };
}

function unmaskTokens(text: string, map: Map<string, string>): string {
    let result = text;
    for (const [placeholder, original] of map) result = result.split(placeholder).join(original);
    return result;
}

function hasAllPlaceholdersExactlyOnce(text: string, map: Map<string, string>): boolean {
    for (const placeholder of map.keys()) {
        if (text.split(placeholder).length !== 2) return false;
    }
    return true;
}

function normalizedBigrams(text: string): Set<string> {
    const normalized = text.toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}@]+/gu, " ")
        .trim();
    const result = new Set<string>();
    for (let i = 0; i < normalized.length - 1; i++) result.add(normalized.slice(i, i + 2));
    return result;
}

function isConservativeCorrection(original: string, corrected: string): boolean {
    const lengthRatio = corrected.length / Math.max(1, original.length);
    if (lengthRatio < 0.65 || lengthRatio > 1.35) return false;

    const originalWords = original.trim().split(/\s+/).filter(Boolean).length;
    const correctedWords = corrected.trim().split(/\s+/).filter(Boolean).length;
    if (Math.abs(originalWords - correctedWords) > Math.max(2, Math.ceil(originalWords * 0.25))) return false;

    const before = normalizedBigrams(original);
    const after = normalizedBigrams(corrected);
    if (before.size === 0 || after.size === 0) return originalWords === correctedWords;
    let overlap = 0;
    for (const pair of before) if (after.has(pair)) overlap++;
    const dice = (2 * overlap) / (before.size + after.size);
    return dice >= (original.length < 20 ? 0.55 : 0.62);
}

function lexicalWords(text: string): string[] {
    return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.map(word =>
        word.toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/['’]/g, "")
    ) ?? [];
}

function editDistance(a: string, b: string): number {
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const above = previous[j];
            previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
            diagonal = above;
        }
    }
    return previous[b.length];
}

const GRAMMAR_WORDS = new Set([
    "a", "au", "aux", "avec", "ce", "cet", "cette", "ces", "dans", "de", "des", "du", "en", "et",
    "la", "le", "les", "leur", "leurs", "lui", "ma", "mais", "me", "mes", "moi", "mon", "ne", "ni",
    "non", "nous", "on", "ou", "par", "pas", "pour", "que", "qui", "sa", "se", "ses", "son", "sur",
    "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vous", "y",
]);

function isLocalWordCorrection(before: string, after: string): boolean {
    if (before === after) return true;
    const longest = Math.max(before.length, after.length);
    const maxEdits = longest <= 4 ? 1 : Math.min(3, Math.ceil(longest * 0.34));
    return editDistance(before, after) <= maxEdits;
}

/**
 * Preserve content vocabulary in order. Small grammar words may be inserted
 * or removed when required for articles, prepositions, pronouns or negation.
 */
function keepsOriginalVocabulary(original: string, corrected: string): boolean {
    const before = lexicalWords(original);
    const after = lexicalWords(corrected);
    const reachable = Array.from({ length: before.length + 1 }, () =>
        Array<boolean>(after.length + 1).fill(false)
    );
    reachable[0][0] = true;

    for (let i = 0; i <= before.length; i++) {
        for (let j = 0; j <= after.length; j++) {
            if (!reachable[i][j]) continue;
            if (i < before.length && j < after.length && isLocalWordCorrection(before[i], after[j])) {
                reachable[i + 1][j + 1] = true;
            }
            if (i < before.length && GRAMMAR_WORDS.has(before[i])) reachable[i + 1][j] = true;
            if (j < after.length && GRAMMAR_WORDS.has(after[j])) reachable[i][j + 1] = true;
        }
    }

    if (reachable[before.length][after.length]) return true;

    // A single unusual contraction in a long message used to reject the whole
    // correction. Measure the minimum amount of genuinely changed vocabulary
    // while still treating articles/pronouns/prepositions as grammar edits.
    if (before.length < 14) return false;

    const costs = Array.from({ length: before.length + 1 }, () =>
        Array<number>(after.length + 1).fill(Number.POSITIVE_INFINITY)
    );
    costs[0][0] = 0;
    for (let i = 0; i <= before.length; i++) {
        for (let j = 0; j <= after.length; j++) {
            const current = costs[i][j];
            if (!Number.isFinite(current)) continue;

            if (i < before.length && j < after.length) {
                const substitutionCost = isLocalWordCorrection(before[i], after[j]) ? 0 : 1;
                costs[i + 1][j + 1] = Math.min(costs[i + 1][j + 1], current + substitutionCost);
            }
            if (i < before.length) {
                costs[i + 1][j] = Math.min(costs[i + 1][j], current + (GRAMMAR_WORDS.has(before[i]) ? 0.15 : 1));
            }
            if (j < after.length) {
                costs[i][j + 1] = Math.min(costs[i][j + 1], current + (GRAMMAR_WORDS.has(after[j]) ? 0.15 : 1));
            }

            // Accept contractions split into two words ("jsais" → "je sais")
            // and the inverse without considering them a vocabulary rewrite.
            if (i < before.length && j + 1 < after.length &&
                isLocalWordCorrection(before[i], after[j] + after[j + 1])) {
                costs[i + 1][j + 2] = Math.min(costs[i + 1][j + 2], current);
            }
            if (i + 1 < before.length && j < after.length &&
                isLocalWordCorrection(before[i] + before[i + 1], after[j])) {
                costs[i + 2][j + 1] = Math.min(costs[i + 2][j + 1], current);
            }
        }
    }

    const mismatchRatio = costs[before.length][after.length] / Math.max(before.length, after.length);
    return mismatchRatio <= 0.12;
}

const correctionCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 100;

function cacheCorrection(key: string, value: string) {
    correctionCache.delete(key);
    correctionCache.set(key, value);
    if (correctionCache.size > MAX_CACHE_ENTRIES) {
        correctionCache.delete(correctionCache.keys().next().value!);
    }
}

// ── Safety nets ──────────────────────────────────────────────────────────────
// The response is validated word by word below. The remaining checks cover
// refusals and offensive words invented by the model.

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
    const originalWords = original.trim().split(/\s+/).map(normalizeForSeverityCheck).filter(Boolean);
    const correctedWords = corrected.trim().split(/\s+/).map(normalizeForSeverityCheck).filter(Boolean);

    return correctedWords.some(word =>
        SEVERE_TERMS.has(word) && !originalWords.some(originalWord => isLocalWordCorrection(originalWord, word))
    );
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

const ABBREVIATION_RULE =
    "Une abréviation valide déjà reconnue est protégée et doit rester identique. " +
    "Si une abréviation semble mal tapée d'une seule lettre, corrige uniquement cette lettre vers " +
    "l'abréviation évidente; ne développe jamais une abréviation en mots complets.";

const LANG_PROMPTS: Record<string, string> = {
    fr: "Tu es un correcteur orthographique et grammatical. Corrige les fautes d'orthographe, de grammaire, " +
        "de conjugaison et d'accord, ainsi que la ponctuation (virgules, points, points d'interrogation/" +
        "d'exclamation, apostrophes, majuscules de début de phrase) pour que le texte soit correct et lisible. " +
        "Travaille mot pour mot : ne change pas le sens, ne reformule aucune phrase et ne remplace jamais un mot " +
        "par un synonyme. Tu peux seulement ajouter, retirer ou corriger les petits mots grammaticaux indispensables " +
        "(articles, pronoms, prépositions et négations). Corrige aussi l'orthographe et les accords des insultes sans les censurer, les adoucir, " +
        "les intensifier ou les supprimer. Préserve exactement le registre, le ton et l'argot. " +
        "Même si le texte est long, corrige-le entièrement du premier au dernier mot sans ignorer ni omettre de passage. " +
        ABBREVIATION_RULE + " Si le texte est déjà correct, retourne-le identique. Retourne UNIQUEMENT le " +
        "texte corrigé, sans guillemets ni explication.",
    en: "You are a spelling and grammar checker. Fix spelling, grammar, conjugation and agreement mistakes, " +
        "as well as punctuation (commas, periods, question/exclamation marks, apostrophes, sentence-starting " +
        "capital letters) so the text reads correctly. Don't change the meaning of the message, don't reword " +
        "sentences that are already correct, and don't swap a word for a synonym. If the text is already " +
        "correct, return it as-is. Preserve tone, profanity, slang and abbreviations exactly; never censor, soften " +
        "or intensify them. Return ONLY the corrected text, without quotes or explanation.",
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
    const cacheKey = `${lang}\0${text}`;
    const cached = correctionCache.get(cacheKey);
    if (cached != null) return cached;
    const systemPrompt = (LANG_PROMPTS[lang] ?? LANG_PROMPTS.en) + "\n\n" + PLACEHOLDER_RULE;

    const { masked, map } = maskProtectedTokens(text);

    try {
        const correctedMasked = await groqChat({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: masked },
            ],
            temperature: 0,
            // GPT-OSS otherwise spends a tiny output budget entirely on its
            // hidden reasoning and may return an empty correction.
            // Discord messages can be several thousand characters long. Keep
            // enough room for the complete corrected text plus light model
            // reasoning, otherwise a truncated answer is rejected unchanged.
            maxTokens: Math.min(4096, Math.max(768, Math.ceil(masked.length * 0.9))),
            reasoningEffort: "low",
            // Forcer un modèle léger pour la correction — économise le quota du 120B pour l'IA
            forceModel: "openai/gpt-oss-20b",
        });

        if (!correctedMasked || correctedMasked.trim() === "") return text;
        if (!hasAllPlaceholdersExactlyOnce(correctedMasked, map)) {
            console.warn("[AutoCorrect] Rejected: protected token changed, removed or duplicated");
            return text;
        }

        // Le modèle a refusé de traiter le message (garde-fou interne à Groq) —
        // ce refus n'est pas une correction, on garde le texte original.
        if (isRefusalResponse(correctedMasked)) {
            console.warn("[AutoCorrect] Rejected: model refused instead of correcting", { text, response: correctedMasked });
            return text;
        }

        const corrected = unmaskTokens(correctedMasked, map).replace(/^"(.*)"$/, "$1").trim();

        if (corrected === text) {
            cacheCorrection(cacheKey, text);
            return text;
        }

        // Sécurité contre les répétitions infinies ou les hallucinations
        if (corrected.toLowerCase().includes("correction:") || corrected.toLowerCase().includes("text:")) return text;

        // Orthographic corrections remain very close to the source. Reject
        // paraphrases even when they happen to have a similar total length.
        if (!isConservativeCorrection(text, corrected)) {
            console.warn("[AutoCorrect] Rejected: correction changed the wording too much", { text, corrected });
            return text;
        }

        if (!keepsOriginalVocabulary(text, corrected)) {
            console.warn("[AutoCorrect] Rejected: correction did not remain word-for-word", { text, corrected });
            return text;
        }

        // Filet de sécurité absolu : jamais de mot sensible/offensant halluciné,
        // même si le reste de la correction semblait raisonnable.
        if (introducesHallucinatedSevereTerm(text, corrected)) {
            console.warn("[AutoCorrect] Rejected: correction introduced a sensitive term absent from the original", { text, corrected });
            return text;
        }

        cacheCorrection(cacheKey, corrected);
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
