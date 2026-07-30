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
        label: "FranÃ§ais",
        system: "Tu es un AutoResponder ultra-personnalisable pour Discord.",
        selfLabel: "MOI",
        otherLabel: "L'AMI",
        sections: {
            myInfo: "MES INFOS PERSONNELLES",
            myInstructions: "MES INSTRUCTIONS",
            blacklist: "LISTE NOIRE",
            history: "HISTORIQUE",
            latestMessage: "DERNIER MESSAGE",
            rules: "RÃˆGLES DE COMPORTEMENT (CRUCIAL)",
            mission: "MISSION",
        },
        rules: [
            "RÃ‰PONSES COURTES : Fais des rÃ©ponses concises (1 ou 2 phrases max). Ne fais pas de longs paragraphes.",
            "DISCRÃ‰TION DES INFOS : N'utilise mes infos personnelles que si c'est pertinent.",
            "STYLE Ã‰CRIT NATUREL : Supprime toute trace d'hÃ©sitation orale.",
            "HUMAIN : Parle comme un pote sur Discord.",
        ],
        mission: "RÃ©ponds de maniÃ¨re naturelle. NE RENVOIE QUE LE TEXTE DE TA RÃ‰PONSE.",
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
        label: "EspaÃ±ol",
        system: "Eres un AutoResponder altamente personalizable para Discord.",
        selfLabel: "YO",
        otherLabel: "ELLOS",
        sections: {
            myInfo: "MI INFORMACIÃ“N PERSONAL",
            myInstructions: "MIS INSTRUCCIONES",
            blacklist: "LISTA NEGRA",
            history: "HISTORIAL",
            latestMessage: "ÃšLTIMO MENSAJE",
            rules: "REGLAS DE COMPORTAMIENTO (CRUCIAL)",
            mission: "MISIÃ“N",
        },
        rules: [
            "RESPUESTAS CORTAS: Responde de forma concisa (1-2 frases mÃ¡x.). Sin pÃ¡rrafos largos.",
            "DISCRECIÃ“N: Solo usa mi informaciÃ³n personal si es relevante.",
            "ESTILO NATURAL: Elimina cualquier rastro de duda o hesitaciÃ³n oral.",
            "HUMANO: Habla como un amigo en Discord.",
        ],
        mission: "Responde de forma natural. SOLO DEVUELVE EL TEXTO DE TU RESPUESTA.",
    },
    de: {
        label: "Deutsch",
        system: "Du bist ein hochgradig anpassbarer AutoResponder fÃ¼r Discord.",
        selfLabel: "ICH",
        otherLabel: "SIE",
        sections: {
            myInfo: "MEINE PERSÃ–NLICHEN DATEN",
            myInstructions: "MEINE ANWEISUNGEN",
            blacklist: "SPERRLISTE",
            history: "VERLAUF",
            latestMessage: "LETZTE NACHRICHT",
            rules: "VERHALTENSREGELN (KRITISCH)",
            mission: "AUFGABE",
        },
        rules: [
            "KURZE ANTWORTEN: Halte Antworten kurz (max. 1-2 SÃ¤tze). Keine langen AbsÃ¤tze.",
            "DISKRETION: Verwende persÃ¶nliche Infos nur, wenn relevant.",
            "NATÃœRLICHER STIL: Keine zÃ¶gernden AusdrÃ¼cke.",
            "MENSCHLICH: Rede wie ein Freund auf Discord.",
        ],
        mission: "Antworte natÃ¼rlich. GIB NUR DEN TEXT DEINER ANTWORT ZURÃœCK.",
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
        label: "PortuguÃªs",
        system: "VocÃª Ã© um AutoResponder altamente personalizÃ¡vel para o Discord.",
        selfLabel: "EU",
        otherLabel: "ELES",
        sections: {
            myInfo: "MINHAS INFORMAÃ‡Ã•ES PESSOAIS",
            myInstructions: "MINHAS INSTRUÃ‡Ã•ES",
            blacklist: "LISTA NEGRA",
            history: "HISTÃ“RICO",
            latestMessage: "ÃšLTIMA MENSAGEM",
            rules: "REGRAS DE COMPORTAMENTO (CRUCIAIS)",
            mission: "MISSÃƒO",
        },
        rules: [
            "RESPOSTAS CURTAS: Respostas concisas (mÃ¡x. 1-2 frases). Sem parÃ¡grafos longos.",
            "DISCRIÃ‡ÃƒO: Use minhas informaÃ§Ãµes pessoais sÃ³ quando relevante.",
            "ESTILO NATURAL: Elimine qualquer traÃ§o de hesitaÃ§Ã£o oral.",
            "HUMANO: Fale como um amigo no Discord.",
        ],
        mission: "Responda naturalmente. SÃ“ RETORNE O TEXTO DA SUA RESPOSTA.",
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
        system: "JesteÅ› wysoce konfigurowalnym AutoResponderem dla Discorda.",
        selfLabel: "JA",
        otherLabel: "ONI",
        sections: {
            myInfo: "MOJE DANE OSOBOWE",
            myInstructions: "MOJE INSTRUKCJE",
            blacklist: "CZARNA LISTA",
            history: "HISTORIA",
            latestMessage: "OSTATNIA WIADOMOÅšÄ†",
            rules: "ZASADY ZACHOWANIA (KRYTYCZNE)",
            mission: "MISJA",
        },
        rules: [
            "KRÃ“TKIE ODPOWIEDZI: Odpowiadaj zwiÄ™Åºle (maks. 1-2 zdania). Bez dÅ‚ugich akapitÃ³w.",
            "DYSKRECJA: UÅ¼ywaj moich danych osobowych tylko gdy to istotne.",
            "NATURALNY STYL: UsuÅ„ wszelkie Å›lady ustnego wahania.",
            "LUDZKI: MÃ³w jak znajomy na Discordzie.",
        ],
        mission: "Odpowiedz naturalnie. ZWRÃ“Ä† TYLKO TEKST SWOJEJ ODPOWIEDZI.",
    },
    ja: {
        label: "æ—¥æœ¬èªž",
        system: "ã‚ãªãŸã¯Discordã®ãŸã‚ã®é«˜åº¦ã«ã‚«ã‚¹ã‚¿ãƒžã‚¤ã‚ºå¯èƒ½ãªAutoResponderã§ã™ã€‚",
        selfLabel: "ç§",
        otherLabel: "å‘ã",
        sections: {
            myInfo: "å€‹äººæƒ…å ±",
            myInstructions: "ã‚¤ãƒ³ã‚¹ãƒˆãƒ©ã‚¯ã‚·ãƒ§ãƒ³",
            blacklist: "ãƒ–ãƒ©ãƒƒã‚¯ãƒªã‚¹ãƒˆ",
            history: "éŽåŽ»ã®ãƒ¡ãƒƒã‚»ãƒ¼ã‚¸",
            latestMessage: "æœ€æ–°ãƒ¡ãƒƒã‚»ãƒ¼ã‚¸",
            rules: "è¡Œå‹•ãƒ«ãƒ¼ãƒ«（é‡è¦）",
            mission: "ä»»å‹™",
        },
        rules: [
            "çŸ­ãå›žç­”ï¼š1-2æ–‡ã§ç°¡æ½”ã«。é•·æ–‡ã¯ä¸è¦。",
            "æƒ…å ±ã®é©åˆ‡ãªä½¿ç”¨ï¼šå€‹äººæƒ…å ±ã¯å¿…è¦ãªã¨ãã®ã¿ä½¿ç”¨。",
            "è‡ªç„¶ãªè¡¨ç¾ï¼šå£èªžã®æŠœçµ¶ãƒ»é”™ã„ã‚’æ¶ˆã™。",
            "äººé–“ã‚‰ã—ãï¼šDiscordã§ã®å‹é”ã¨ã—ã¦è©±ã™。",
        ],
        mission: "è‡ªç„¶ã«å¿œç­”ã—ã¦ãã ã•ã„。å¿œç­”æ–‡ã®ã¿ã‚’è¿”ã—ã¦ãã ã•ã„ã€‚",
    },
    zh: {
        label: "ä¸­æ–‡",
        system: "ä½ æ˜¯ä¸€ä¸ªé«˜åº¦å¯è‡ªå®šä¹‰çš„Discordè‡ªåŠ¨å›žå¤å™¨ã€‚",
        selfLabel: "æˆ‘",
        otherLabel: "ä»–ä»¬",
        sections: {
            myInfo: "æˆ‘çš„ä¸ªäººä¿¡æ¯",
            myInstructions: "æˆ‘çš„æŒ‡ä»¤",
            blacklist: "é»‘åå•",
            history: "åŽ†å²è®°å½•",
            latestMessage: "æœ€æ–°æ¶ˆæ¯",
            rules: "è¡Œä¸ºè§„åˆ™（å…³é”®）",
            mission: "ä»»åŠ¡",
        },
        rules: [
            "çŸ­ç­”å¤ï¼šå›žå¤ç®€æ´（æœ€å¤š1-2å¥）。ä¸è¦é•¿æ®µè½ã€‚",
            "ä¿¡æ¯é…Œå®¡ï¼šåªåœ¨ç›¸å…³æ—¶ä½¿ç”¨æˆ‘çš„ä¸ªäººä¿¡æ¯ã€‚",
            "è‡ªç„¶é£Žæ ¼ï¼šåŽ»é™¤ä¸€åˆ‡å£å¤´çŠ¹è±«çš„ç—•è¿¹ã€‚",
            "äººæ€§åŒ–ï¼šåƒDiscordä¸Šçš„æœ‹å‹ä¸€æ ·è¯´è¯ã€‚",
        ],
        mission: "è‡ªç„¶åœ°å›žå¤。åªè¿”å›žä½ çš„å›žå¤æ–‡æœ¬ã€‚",
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
                <span style={{ fontSize: "24px" }}>âš ï¸</span>
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

        const lang = LANGUAGES[settings.store.responseLanguage] ?? LANGUAGES.fr;

        let localHistory = "";
        try {
            const msgs = MessageStore.getMessages(message.channel_id).toArray().slice(-15);
            localHistory = msgs.map((m: any) => {
                const author = m.author.id === currentUser.id ? lang.selfLabel : lang.otherLabel;
                return `${author}: ${m.content}`;
            }).join("\n");
        } catch { }

        const rulesText = lang.rules.map((r, i) => `${i + 1}. ${r}`).join("\n");

        const prompt = `Tu es l'utilisateur (${lang.selfLabel}). RÃ©ponds au dernier message de ${lang.otherLabel}.
        
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

        if (reply && !reply.startsWith("âŒ")) {
            // Délai réaliste : base fixe + temps proportionnel à la longueur du message
            const baseDelay = Math.floor(Math.random() * (settings.store.delayMax - settings.store.delayMin + 1) + settings.store.delayMin);
            const extraDelay = reply.length > 100 ? 2 : 0; // +2s si message long
            const totalDelay = (baseDelay + extraDelay) * 1000;

            try {
                const TypingActions = findByPropsLazy("startTyping");
                TypingActions.startTyping(message.channel_id);
            } catch { }

            setTimeout(async () => {
                await RestAPI.post({
                    url: `/channels/${message.channel_id}/messages`,
                    body: { content: reply }
                });
            }, totalDelay);
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
    }
});
