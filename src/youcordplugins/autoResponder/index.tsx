/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, React, RestAPI, Text, UserStore } from "@webpack/common";

import plugins from "~plugins";

import { getGroqKey, groqChat } from "../youcordAI/groqManager";

const MessageStore = findByPropsLazy("getMessages");
const pendingReplyTimers = new Set<ReturnType<typeof setTimeout>>();

const LANGUAGES: Record<string, {
    label: string;
    system: string;
    selfLabel: string;
    otherLabel: string;
    sections: {
        myInfo: string;
        myInstructions: string;
        blacklist: string;
        history: string;
        latestMessage: string;
        rules: string;
        mission: string;
    };
    rules: string[];
    mission: string;
}> = {
    fr: {
        label: "Français",
        system: "Tu es un AutoResponder ultra-personnalisable pour Discord.",
        selfLabel: "MOI",
        otherLabel: "L'AMI",
        sections: {
            myInfo: "MES INFOS PERSONNELLES",
            myInstructions: "MES INSTRUCTIONS",
            blacklist: "LISTE NOIRE",
            history: "HISTORIQUE",
            latestMessage: "DERNIER MESSAGE",
            rules: "RÈGLES DE COMPORTEMENT (CRUCIAL)",
            mission: "MISSION",
        },
        rules: [
            "RÉPONSES COURTES : Fais des réponses concises (1 ou 2 phrases max). Ne fais pas de longs paragraphes.",
            "DISCRÉTION DES INFOS : N'utilise mes infos personnelles que si c'est pertinent.",
            "STYLE ÉCRIT NATUREL : Supprime toute trace d'hésitation orale.",
            "HUMAIN : Parle comme un pote sur Discord.",
        ],
        mission: "Réponds de manière naturelle. NE RENVOIE QUE LE TEXTE DE TA RÉPONSE.",
    },
    en: {
        label: "English",
        system: "You are a highly customizable AutoResponder for Discord.",
        selfLabel: "ME",
        otherLabel: "THEM",
        sections: {
            myInfo: "MY PERSONAL INFO",
            myInstructions: "MY INSTRUCTIONS",
            blacklist: "BLACKLIST",
            history: "HISTORY",
            latestMessage: "LATEST MESSAGE",
            rules: "BEHAVIOR RULES (CRITICAL)",
            mission: "MISSION",
        },
        rules: [
            "SHORT REPLIES: Keep responses concise (1-2 sentences max). No long paragraphs.",
            "INFO DISCRETION: Only use my personal info when relevant.",
            "NATURAL WRITING: Remove all traces of oral hesitation.",
            "HUMAN: Talk like a friend on Discord.",
        ],
        mission: "Reply naturally. ONLY RETURN THE TEXT OF YOUR REPLY.",
    },
    es: {
        label: "Español",
        system: "Eres un AutoResponder altamente personalizable para Discord.",
        selfLabel: "YO",
        otherLabel: "ELLOS",
        sections: {
            myInfo: "MI INFORMACIÓN PERSONAL",
            myInstructions: "MIS INSTRUCCIONES",
            blacklist: "LISTA NEGRA",
            history: "HISTORIAL",
            latestMessage: "ÚLTIMO MENSAJE",
            rules: "REGLAS DE COMPORTAMIENTO (CRUCIAL)",
            mission: "MISIÓN",
        },
        rules: [
            "RESPUESTAS CORTAS: Responde de forma concisa (1-2 frases máx.). Sin párrafos largos.",
            "DISCRECIÓN: Solo usa mi información personal si es relevante.",
            "ESTILO NATURAL: Elimina cualquier rastro de duda o hesitación oral.",
            "HUMANO: Habla como un amigo en Discord.",
        ],
        mission: "Responde de forma natural. SOLO DEVUELVE EL TEXTO DE TU RESPUESTA.",
    },
    de: {
        label: "Deutsch",
        system: "Du bist ein hochgradig anpassbarer AutoResponder für Discord.",
        selfLabel: "ICH",
        otherLabel: "SIE",
        sections: {
            myInfo: "MEINE PERSÖNLICHEN DATEN",
            myInstructions: "MEINE ANWEISUNGEN",
            blacklist: "SPERRLISTE",
            history: "VERLAUF",
            latestMessage: "LETZTE NACHRICHT",
            rules: "VERHALTENSREGELN (KRITISCH)",
            mission: "AUFGABE",
        },
        rules: [
            "KURZE ANTWORTEN: Halte Antworten kurz (max. 1-2 Sätze). Keine langen Absätze.",
            "DISKRETION: Verwende persönliche Infos nur, wenn relevant.",
            "NATÜRLICHER STIL: Keine zögernden Ausdrücke.",
            "MENSCHLICH: Rede wie ein Freund auf Discord.",
        ],
        mission: "Antworte natürlich. GIB NUR DEN TEXT DEINER ANTWORT ZURÜCK.",
    },
    it: {
        label: "Italiano",
        system: "Sei un AutoResponder altamente personalizzabile per Discord.",
        selfLabel: "IO",
        otherLabel: "LORO",
        sections: {
            myInfo: "MIE INFORMAZIONI PERSONALI",
            myInstructions: "MIE ISTRUZIONI",
            blacklist: "LISTA NERA",
            history: "CRONOLOGIA",
            latestMessage: "ULTIMO MESSAGGIO",
            rules: "REGOLE DI COMPORTAMENTO (CRITICHE)",
            mission: "MISSIONE",
        },
        rules: [
            "RISPOSTE BREVI: Risposte concise (max 1-2 frasi). Niente paragrafi lunghi.",
            "DISCREZIONE: Usa le mie informazioni personali solo se pertinente.",
            "STILE NATURALE: Elimina ogni traccia di esitazione orale.",
            "UMANO: Parla come un amico su Discord.",
        ],
        mission: "Rispondi in modo naturale. RESTITUISCI SOLO IL TESTO DELLA TUA RISPOSTA.",
    },
    pt: {
        label: "Português",
        system: "Você é um AutoResponder altamente personalizável para o Discord.",
        selfLabel: "EU",
        otherLabel: "ELES",
        sections: {
            myInfo: "MINHAS INFORMAÇÕES PESSOAIS",
            myInstructions: "MINHAS INSTRUÇÕES",
            blacklist: "LISTA NEGRA",
            history: "HISTÓRICO",
            latestMessage: "ÚLTIMA MENSAGEM",
            rules: "REGRAS DE COMPORTAMENTO (CRUCIAIS)",
            mission: "MISSÃO",
        },
        rules: [
            "RESPOSTAS CURTAS: Respostas concisas (máx. 1-2 frases). Sem parágrafos longos.",
            "DISCRIÇÃO: Use minhas informações pessoais só quando relevante.",
            "ESTILO NATURAL: Elimine qualquer traço de hesitação oral.",
            "HUMANO: Fale como um amigo no Discord.",
        ],
        mission: "Responda naturalmente. SÓ RETORNE O TEXTO DA SUA RESPOSTA.",
    },
    nl: {
        label: "Nederlands",
        system: "Je bent een zeer aanpasbare AutoResponder voor Discord.",
        selfLabel: "IK",
        otherLabel: "ZIJ",
        sections: {
            myInfo: "MIJN PERSOONLIJKE GEGEVENS",
            myInstructions: "MIJN INSTRUCTIES",
            blacklist: "ZWARTE LIJST",
            history: "GESCHIEDENIS",
            latestMessage: "LAATSTE BERICHT",
            rules: "GEDRAGSREGELS (CRITICAAL)",
            mission: "MISSIE",
        },
        rules: [
            "KORTE ANTWOORDEN: Houd antwoorden kort (max 1-2 zinnen). Geen lange paragrafen.",
            "DISCRETIE: Gebruik mijn persoonlijke gegevens alleen wanneer relevant.",
            "NATUURLIJKE STIJL: Verwijder alle sporen van mondelinge aarzeling.",
            "MENSELIJK: Praat als een vriend op Discord.",
        ],
        mission: "Reageer natuurlijk. GEGEN ALLEEN DE TEKST VAN JE ANTWOORD TERUG.",
    },
    pl: {
        label: "Polski",
        system: "Jesteś wysoce konfigurowalnym AutoResponderem dla Discorda.",
        selfLabel: "JA",
        otherLabel: "ONI",
        sections: {
            myInfo: "MOJE DANE OSOBOWE",
            myInstructions: "MOJE INSTRUKCJE",
            blacklist: "CZARNA LISTA",
            history: "HISTORIA",
            latestMessage: "OSTATNIA WIADOMOŚĆ",
            rules: "ZASADY ZACHOWANIA (KRYTYCZNE)",
            mission: "MISJA",
        },
        rules: [
            "KRÓTKIE ODPOWIEDZI: Odpowiadaj zwięźle (maks. 1-2 zdania). Bez długich akapitów.",
            "DYSKRECJA: Używaj moich danych osobowych tylko gdy to istotne.",
            "NATURALNY STYL: Usuń wszelkie ślady ustnego wahania.",
            "LUDZKI: Mów jak znajomy na Discordzie.",
        ],
        mission: "Odpowiedz naturalnie. ZWRÓĆ TYLKO TEKST SWOJEJ ODPOWIEDZI.",
    },
    ja: {
        label: "日本語",
        system: "あなたはDiscordのための高度にカスタマイズ可能なAutoResponderです。",
        selfLabel: "私",
        otherLabel: "向き",
        sections: {
            myInfo: "個人情報",
            myInstructions: "インストラクション",
            blacklist: "ブラックリスト",
            history: "過去のメッセージ",
            latestMessage: "最新メッセージ",
            rules: "行動ルール（重要）",
            mission: "任務",
        },
        rules: [
            "短く回答：1-2文で簡潔に。長文は不要。",
            "情報の適切な使用：個人情報は必要なときのみ使用。",
            "自然な表現：口語の抜絶・错いを消す。",
            "人間らしく：Discordでの友達として話す。",
        ],
        mission: "自然に応答してください。応答文のみを返してください。",
    },
    zh: {
        label: "中文",
        system: "你是一个高度可自定义的Discord自动回复器。",
        selfLabel: "我",
        otherLabel: "他们",
        sections: {
            myInfo: "我的个人信息",
            myInstructions: "我的指令",
            blacklist: "黑名单",
            history: "历史记录",
            latestMessage: "最新消息",
            rules: "行为规则（关键）",
            mission: "任务",
        },
        rules: [
            "短答复：回复简洁（最多1-2句）。不要长段落。",
            "信息酌审：只在相关时使用我的个人信息。",
            "自然风格：去除一切口头犹豫的痕迹。",
            "人性化：像Discord上的朋友一样说话。",
        ],
        mission: "自然地回复。只返回你的回复文本。",
    },
};

const LANG_OPTIONS = Object.entries(LANGUAGES).map(([value, lang]) => ({
    label: lang.label,
    value
}));

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => (
            <div style={{
                backgroundColor: "rgba(250, 166, 26, 0.1)",
                border: "1px solid var(--status-warning)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#FFFFFF"
            }}>
                <span style={{ fontSize: "24px" }}>⚠️</span>
                <div>
                    <div style={{ fontWeight: "bold", color: "var(--status-warning)" }}>API Key Required</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>
                        AutoResponder requires a Groq API Key to function.
                        Please configure it once in the <strong>YouCordAI</strong> settings.
                    </div>
                </div>
            </div>
        )
    },
    isActive: {
        type: OptionType.BOOLEAN,
        description: "AutoResponder functional status",
        default: false,
        restartNeeded: false
    },
    responseLanguage: {
        type: OptionType.SELECT,
        description: "Language for AI responses",
        options: LANG_OPTIONS,
        default: "fr",
        restartNeeded: false,
    },
    personalInfo: {
        type: OptionType.STRING,
        description: "Personal Information (Name, Age, Location, etc.)",
        default: "",
        restartNeeded: false,
    },
    writingStyle: {
        type: OptionType.STRING,
        description: "Your Writing Style (e.g. casual, no caps, use 'ptn', etc.)",
        default: "",
        restartNeeded: false,
    },
    customInstructions: {
        type: OptionType.STRING,
        description: "Custom Instructions (What to say or NOT to say)",
        default: "",
        restartNeeded: false,
    },
    blacklistedWords: {
        type: OptionType.STRING,
        description: "Blacklisted Words or Topics (comma separated)",
        default: "",
        restartNeeded: false,
    },
    blacklistedUsers: {
        type: OptionType.STRING,
        description: "Blacklisted User IDs (comma separated) — AutoResponder will not reply to these users.",
        default: "",
        restartNeeded: false,
    },
    delayMin: {
        type: OptionType.NUMBER,
        description: "Minimum Delay (seconds)",
        default: 5,
        restartNeeded: false,
    },
    delayMax: {
        type: OptionType.NUMBER,
        description: "Maximum Delay (seconds)",
        default: 12,
        restartNeeded: false,
    }
});

const DS_STYLE_KEY = "auto-responder-global-style";

let lastMessageId = "";
const cachedGlobalStyle = "";

async function handleMessage(message: any) {
    if (!settings.store.isActive) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || message.author.id === currentUser.id) return;

    // Vérification de la blacklist utilisateurs
    const blacklistedUsers = settings.store.blacklistedUsers?.split(",").map((id: string) => id.trim()) || [];
    if (blacklistedUsers.includes(message.author.id)) {
        console.log(`[AutoResponder] Skipping blacklisted user: ${message.author.username} (${message.author.id})`);
        return;
    }

    if (message.id === lastMessageId) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    // RESTRICTION STRICTE : Uniquement les DMs (Type 1)
    if (!channel || channel.type !== 1) return;

    lastMessageId = message.id;

    try {
        const apiKey = await getGroqKey();
        if (!apiKey) {
            try {
                const { openConfirmationModal } = findByPropsLazy("openConfirmationModal");
                openConfirmationModal({
                    header: "API Key Required",
                    content: "AutoResponder requires a Groq API Key to function. Please configure it once in the YouCordAI settings.",
                    confirmText: "Configure YouCordAI",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        const { openModal } = findByPropsLazy("openModal");
                        // Logique pour ouvrir les settings YouCordAI si possible
                    }
                });
            } catch (e) {
                console.error("[AutoResponder] API Key missing and could not open modal", e);
            }
            return;
        }

        const language = settings.store.responseLanguage ?? "fr";
        const lang = LANGUAGES[language as keyof typeof LANGUAGES] ?? LANGUAGES.fr;

        let localHistory = "";
        try {
            const msgs = MessageStore.getMessages(message.channel_id).toArray().slice(-15);
            localHistory = msgs.map((m: any) => {
                const author = m.author.id === currentUser.id ? lang.selfLabel : lang.otherLabel;
                return `${author}: ${m.content}`;
            }).join("\n");
        } catch { }

        const rulesText = lang.rules.map((r, i) => `${i + 1}. ${r}`).join("\n");

        const prompt = `Tu es l'utilisateur (${lang.selfLabel}). Réponds au dernier message de ${lang.otherLabel}.
        
${lang.sections.myInfo} :
${settings.store.personalInfo}

${lang.sections.myInstructions} :
${settings.store.customInstructions}

${lang.sections.blacklist} :
${settings.store.blacklistedWords}

${lang.sections.history} :
${localHistory}

${lang.sections.latestMessage} : "${message.content}"

${lang.sections.rules} :
${rulesText}

${lang.sections.mission} :
${lang.mission}`;

        const reply = await groqChat({
            messages: [
                { role: "system", content: lang.system },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            maxTokens: 500
        });

        if (reply && !reply.startsWith("❌")) {
            // Délai réaliste : base fixe + temps proportionnel à la longueur du message
            const baseDelay = Math.floor(Math.random() * (settings.store.delayMax - settings.store.delayMin + 1) + settings.store.delayMin);
            const extraDelay = reply.length > 100 ? 2 : 0; // +2s si message long
            const totalDelay = (baseDelay + extraDelay) * 1000;

            try {
                const TypingActions = findByPropsLazy("startTyping");
                TypingActions.startTyping(message.channel_id);
            } catch { }

            const timer = setTimeout(async () => {
                pendingReplyTimers.delete(timer);
                await RestAPI.post({
                    url: `/channels/${message.channel_id}/messages`,
                    body: { content: reply }
                });
            }, totalDelay);
            pendingReplyTimers.add(timer);
        }
    } catch (err) {
        console.error("[AutoResponder] Error:", err);
    }
}

const messageCreateListener = (data: any) => {
    // Discord dispatch MESSAGE_CREATE structure can vary
    const msg = data.message || data;
    if (msg && msg.author) {
        handleMessage(msg);
    }
};

const KeyboardIcon = (props: any) => (
    <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <line x1="6" y1="8" x2="6" y2="8" />
        <line x1="10" y1="8" x2="10" y2="8" />
        <line x1="14" y1="8" x2="14" y2="8" />
        <line x1="18" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="6" y2="12" />
        <line x1="10" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="14" y2="12" />
        <line x1="18" y1="12" x2="18" y2="12" />
        <line x1="7" y1="16" x2="17" y2="16" />
        {!props.enabled && <line x1="22" y1="2" x2="2" y2="22" stroke="var(--status-danger)" strokeWidth="2.5" />}
    </svg>
);

let _forceUpdate: () => void = () => { };
function forceRerender() {
    _forceUpdate();
}

const AutoResponderButton = () => {
    const [, setTick] = React.useState(0);
    const isEnabled = settings.store.isActive;

    React.useEffect(() => {
        _forceUpdate = () => setTick(t => t + 1);
        return () => { _forceUpdate = () => { }; };
    }, []);

    const toggle = () => {
        const newState = !settings.store.isActive;

        if (newState) {
            openModal(props => (
                <ModalRoot {...props} size={ModalSize.SMALL}>
                    <ModalHeader separator={false}>
                        <Text variant="heading-lg/semibold">Autoresponder Warning</Text>
                        <ModalCloseButton onClick={props.onClose} />
                    </ModalHeader>
                    <ModalContent>
                        <Text variant="text-md/normal" style={{ marginBottom: 16 }}>
                            Are you sure you want to enable the Autoresponder plugin? An AI will automatically reply to your DMs when you are unavailable.
                        </Text>
                    </ModalContent>
                    <div style={{ padding: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <Button
                            variant="link"
                            onClick={props.onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={async () => {
                                props.onClose();
                                const key = await getGroqKey();
                                if (!key) {
                                    openModal(props2 => (
                                        <ModalRoot {...props2} size={ModalSize.SMALL}>
                                            <ModalHeader separator={false}>
                                                <Text variant="heading-lg/semibold">API Key Required</Text>
                                                <ModalCloseButton onClick={props2.onClose} />
                                            </ModalHeader>
                                            <ModalContent>
                                                <Text variant="text-md/normal" style={{ marginBottom: 16 }}>
                                                    AutoResponder requires a Groq API Key to function. Please configure it once in the YouCordAI settings.
                                                </Text>
                                            </ModalContent>
                                            <div style={{ padding: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                                <Button variant="primary" onClick={props2.onClose}>
                                                    Close
                                                </Button>
                                            </div>
                                        </ModalRoot>
                                    ));
                                    return;
                                }
                                settings.store.isActive = true;
                                setTick(t => t + 1);
                            }}
                        >
                            Enable
                        </Button>
                    </div>
                </ModalRoot>
            ));
        } else {
            settings.store.isActive = false;
            setTick(t => t + 1);
        }
    };

    return (
        <ChatBarButton
            tooltip={`AutoResponder: ${isEnabled ? "ON" : "OFF"}`}
            onClick={toggle}
            onContextMenu={e => {
                e.preventDefault();
                openPluginModal(plugins.AutoResponder ?? plugins.autoResponder);
            }}
        >
            <KeyboardIcon enabled={isEnabled} style={{ color: isEnabled ? "var(--brand-experiment)" : "var(--interactive-normal)" }} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "AutoResponder",
    description: "Automatically reply to DMs using AI to match your writing style.",
    authors: [{ name: "YouCord", id: 0n }],
    settings,
    enabledByDefault: true,
    chatBarButton: {
        icon: KeyboardIcon,
        render: AutoResponderButton,
    },

    flux: {
        async MESSAGE_CREATE(data: any) {
            if (!settings.store.isActive) return;
            const msg = data.message || data;
            if (msg && msg.author) {
                handleMessage(msg);
            }
        }
    },

    start() {
        console.log("[AutoResponder] Plugin starting...");
    },

    stop() {
        for (const timer of pendingReplyTimers) clearTimeout(timer);
        pendingReplyTimers.clear();
    }
});
