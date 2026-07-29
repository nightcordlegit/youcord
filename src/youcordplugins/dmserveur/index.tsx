/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { HeadingPrimary, HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Switch } from "@components/Switch";
import { showApiKeyWarning } from "@utils/apiKeyWarning";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, GuildStore, LocaleStore, React, RestAPI, Select, Slider, TextArea, UserStore } from "@webpack/common";

import { groqChat, hasAnyAIKey } from "../youcordAI/groqManager";

const LOCALE_TO_LANG: Record<string, string> = {
    fr: "french",
    es: "spanish", "es-es": "spanish", "es-419": "spanish",
    de: "german",
    it: "italian",
    pt: "portuguese", "pt-br": "portuguese",
    nl: "dutch",
    ru: "russian",
    ja: "japanese",
    zh: "chinese", "zh-cn": "chinese", "zh-tw": "chinese",
    ko: "korean",
    ar: "arabic",
    pl: "polish",
    tr: "turkish",
};

function getDiscordUILang(): string {
    try {
        const locale = (LocaleStore?.locale ?? "").toLowerCase();
        if (!locale) return "auto";
        if (LOCALE_TO_LANG[locale]) return LOCALE_TO_LANG[locale];
        const base = locale.split("-")[0];
        return LOCALE_TO_LANG[base] ?? "auto";
    } catch { return "auto"; }
}

function t(key: string, ...args: any[]): string {
    const lang = getDiscordUILang();
    const dict = TRANSLATIONS[key];
    if (!dict) return key;
    const text = dict[lang] ?? dict.auto ?? key;
    if (args.length === 0) return text;
    return text.replace(/\{(\d+)\}/g, (_, n) => String(args[parseInt(n)] ?? ""));
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
    "Dmserveur Configuration": {
        auto: "Dmserveur Configuration",
        french: "Configuration Dmserveur",
        spanish: "Configuración de Dmserveur",
        german: "Dmserveur Konfiguration",
        italian: "Configurazione Dmserveur",
        portuguese: "Configuração do Dmserveur",
        dutch: "Dmserveur Configuratie",
        russian: "Настройки Dmserveur",
        japanese: "Dmserveur設定",
        chinese: "Dmserveur 配置",
        korean: "Dmserveur 설정",
        arabic: "إعدادات Dmserveur",
        polish: "Konfiguracja Dmserveur",
        turkish: "Dmserveur Yapılandırması",
    },
    "1. Select a Server": {
        auto: "1. Select Servers",
        french: "1. Choisir des serveurs",
        spanish: "1. Seleccionar servidores",
        german: "1. Server auswählen",
        italian: "1. Seleziona server",
        portuguese: "1. Selecionar servidores",
        dutch: "1. Selecteer servers",
        russian: "1. Выберите серверы",
        japanese: "1. サーバーを選択",
        chinese: "1. 选择服务器",
        korean: "1. 서버 선택",
        arabic: "1. اختر الخوادم",
        polish: "1. Wybierz serwery",
        turkish: "1. Sunucuları seçin",
    },
    "Click to choose a server...": {
        auto: "Click to choose servers...",
        french: "Cliquez pour choisir des serveurs...",
        spanish: "Haga clic para elegir servidores...",
        german: "Klicken Sie, um Server auszuwählen...",
        italian: "Clicca per scegliere server...",
        portuguese: "Clique para escolher servidores...",
        dutch: "Klik om servers te kiezen...",
        russian: "Нажмите, чтобы выбрать серверы...",
        japanese: "クリックしてサーバーを選択...",
        chinese: "点击选择服务器...",
        korean: "클릭하여 서버 선택...",
        arabic: "انقر لاختيار الخوادم...",
        polish: "Kliknij, aby wybrać serwery...",
        turkish: "Sunucu seçmek için tıklayın...",
    },
    "{0} server(s) selected": {
        auto: "{0} server(s) selected",
        french: "{0} serveur(s) sélectionné(s)",
        spanish: "{0} servidor(es) seleccionado(s)",
        german: "{0} Server ausgewählt",
        italian: "{0} server selezionati",
        portuguese: "{0} servidor(es) selecionado(s)",
        dutch: "{0} server(s) geselecteerd",
        russian: "{0} серверов выбрано",
        japanese: "{0} サーバー選択中",
        chinese: "已选 {0} 个服务器",
        korean: "{0}개 서버 선택됨",
        arabic: "تم اختيار {0} خادم",
        polish: "Wybrano serwerów: {0}",
        turkish: "{0} sunucu seçildi",
    },
    "2. Select Channels ({0} selected)": {
        auto: "2. Select Channels ({0} selected)",
        french: "2. Choisir les salons ({0} sélectionné(s))",
        spanish: "2. Seleccionar canales ({0} seleccionado(s))",
        german: "2. Kanäle auswählen ({0} ausgewählt)",
        italian: "2. Seleziona canali ({0} selezionato(i))",
        portuguese: "2. Selecionar canais ({0} selecionado(s))",
        dutch: "2. Kanalen selecteren ({0} geselecteerd)",
        russian: "2. Выберите каналы ({0} выбрано)",
        japanese: "2. チャンネルを選択 ({0} 選択中)",
        chinese: "2. 选择频道（已选 {0} 个）",
        korean: "2. 채널 선택 ({0}개 선택됨)",
        arabic: "2. اختر القنوات ({0} مختارة)",
        polish: "2. Wybierz kanały ({0} wybranych)",
        turkish: "2. Kanalları seçin ({0} seçildi)",
    },
    "No text channels found in this server.": {
        auto: "No text channels found in this server.",
        french: "Aucun salon textuel trouvé dans ce serveur.",
        spanish: "No se encontraron canales de texto en este servidor.",
        german: "Keine Textkanäle in diesem Server gefunden.",
        italian: "Nessun canale testuale trovato in questo server.",
        portuguese: "Nenhum canal de texto encontrado neste servidor.",
        dutch: "Geen tekstkanalen gevonden in deze server.",
        russian: "Текстовые каналы не найдены на этом сервере.",
        japanese: "このサーバーにテキストチャンネルが見つかりません。",
        chinese: "此服务器中未找到文本频道。",
        korean: "이 서버에서 텍스트 채널을 찾을 수 없습니다.",
        arabic: "لم يتم العثور على قنوات نصية في هذا الخادم.",
        polish: "Nie znaleziono kanałów tekstowych na tym serwerze.",
        turkish: "Bu sunucuda metin kanalı bulunamadı.",
    },
    "Clear all channels": {
        auto: "Clear all channels",
        french: "Effacer tous les salons",
        spanish: "Limpiar todos los canales",
        german: "Alle Kanäle löschen",
        italian: "Cancella tutti i canali",
        portuguese: "Limpar todos os canais",
        dutch: "Wis alle kanalen",
        russian: "Очистить все каналы",
        japanese: "すべてのチャンネルをクリア",
        chinese: "清除所有频道",
        korean: "모든 채널 지우기",
        arabic: "مسح جميع القنوات",
        polish: "Wyczyść wszystkie kanały",
        turkish: "Tüm kanalları temizle",
    },
    "Groq API Key Required": {
        auto: "Groq API Key Required",
        french: "Clé API Groq requise",
        spanish: "Clave API de Groq requerida",
        german: "Groq API-Schlüssel erforderlich",
        italian: "Chiave API Groq richiesta",
        portuguese: "Chave API Groq necessária",
        dutch: "Groq API-sleutel vereist",
        russian: "Требуется ключ API Groq",
        japanese: "Groq APIキーが必要です",
        chinese: "需要 Groq API 密钥",
        korean: "Groq API 키가 필요합니다",
        arabic: "مفتاح API Groq مطلوب",
        polish: "Wymagany klucz API Groq",
        turkish: "Groq API Anahtarı Gerekli",
    },
    "This plugin requires a Groq API Key. Configure it once in the YouCordAI settings.": {
        auto: "This plugin requires a Groq API Key. Configure it once in the YouCordAI settings.",
        french: "Ce plugin nécessite une clé API Groq. Configurez-la une fois dans les paramètres YouCordAI.",
        spanish: "Este plugin requiere una clave API de Groq. Configúrela una vez en los ajustes de YouCordAI.",
        german: "Dieses Plugin benötigt einen Groq API-Schlüssel. Konfigurieren Sie ihn einmal in den YouCordAI-Einstellungen.",
        italian: "Questo plugin richiede una chiave API Groq. Configurala una volta nelle impostazioni YouCordAI.",
        portuguese: "Este plugin requer uma chave API Groq. Configure-a uma vez nas configurações do YouCordAI.",
        dutch: "Deze plugin heeft een Groq API-sleutel nodig. Configureer deze eenmalig in de YouCordAI-instellingen.",
        russian: "Этот плагин требует ключ API Groq. Настройте его один раз в настройках YouCordAI.",
        japanese: "このプラグインにはGroq APIキーが必要です。YouCordAI設定で一度設定してください。",
        chinese: "此插件需要 Groq API 密钥。在 YouCordAI 设置中配置一次即可。",
        korean: "이 플러그인은 Groq API 키가 필요합니다. YouCordAI 설정에서 한 번 구성하세요.",
        arabic: "هذا البرنامج المساعد يتطلب مفتاح API Groq. قم بتكوينه مرة واحدة في إعدادات YouCordAI.",
        polish: "Ta wtyczka wymaga klucza API Groq. Skonfiguruj go raz w ustawieniach YouCordAI.",
        turkish: "Bu eklenti bir Groq API Anahtarı gerektirir. YouCordAI ayarlarında bir kez yapılandırın.",
    },
    "members": {
        auto: "members",
        french: "membres",
        spanish: "miembros",
        german: "Mitglieder",
        italian: "membri",
        portuguese: "membros",
        dutch: "leden",
        russian: "участников",
        japanese: "メンバー",
        chinese: "成员",
        korean: "멤버",
        arabic: "أعضاء",
        polish: "członków",
        turkish: "üye",
    },
    "Enable Dmserveur": {
        auto: "Enable Dmserveur",
        french: "Activer Dmserveur",
        spanish: "Activar Dmserveur",
        german: "Dmserveur aktivieren",
        italian: "Attiva Dmserveur",
        portuguese: "Ativar Dmserveur",
        dutch: "Dmserveur inschakelen",
        russian: "Включить Dmserveur",
        japanese: "Dmserveurを有効化",
        chinese: "启用 Dmserveur",
        korean: "Dmserveur 활성화",
        arabic: "تفعيل Dmserveur",
        polish: "Włącz Dmserveur",
        turkish: "Dmserveur'u Etkinleştir",
    },
    "When should Dmserveur respond?": {
        auto: "When should Dmserveur respond?",
        french: "Quand Dmserveur doit-il répondre ?",
        spanish: "¿Cuándo debe responder Dmserveur?",
        german: "Wann soll Dmserveur antworten?",
        italian: "Quando dovrebbe rispondere Dmserveur?",
        portuguese: "Quando o Dmserveur deve responder?",
        dutch: "Wanneer moet Dmserveur reageren?",
        russian: "Когда Dmserveur должен отвечать?",
        japanese: "Dmserveurはいつ応答すべきですか？",
        chinese: "Dmserveur 应该在什么时候回复？",
        korean: "Dmserveur가 언제 응답해야 합니까?",
        arabic: "متى يجب أن يرد Dmserveur؟",
        polish: "Kiedy Dmserveur powinien odpowiadać?",
        turkish: "Dmserveur ne zaman yanıtlamalı?",
    },
    "Only when mentioned (@Dmserveur)": {
        auto: "Only when mentioned (@Dmserveur)",
        french: "Seulement quand on me mentionne (@Dmserveur)",
        spanish: "Solo cuando me mencionan (@Dmserveur)",
        german: "Nur bei Erwähnung (@Dmserveur)",
        italian: "Solo quando vengo menzionato (@Dmserveur)",
        portuguese: "Apenas quando mencionado (@Dmserveur)",
        dutch: "Alleen bij vermelding (@Dmserveur)",
        russian: "Только при упоминании (@Dmserveur)",
        japanese: "メンションされたときのみ (@Dmserveur)",
        chinese: "仅在提到时 (@Dmserveur)",
        korean: "멘션될 때만 (@Dmserveur)",
        arabic: "فقط عند الذكر (@Dmserveur)",
        polish: "Tylko gdy wspomniany (@Dmserveur)",
        turkish: "Yalnızca bahsedildiğinde (@Dmserveur)",
    },
    "All messages in selected channels": {
        auto: "All messages in selected channels",
        french: "Tous les messages dans les salons sélectionnés",
        spanish: "Todos los mensajes en los canales seleccionados",
        german: "Alle Nachrichten in ausgewählten Kanälen",
        italian: "Tutti i messaggi nei canali selezionati",
        portuguese: "Todas as mensagens nos canais selecionados",
        dutch: "Alle berichten in geselecteerde kanalen",
        russian: "Все сообщения в выбранных каналах",
        japanese: "選択したチャンネルのすべてのメッセージ",
        chinese: "选定频道中的所有消息",
        korean: "선택한 채널의 모든 메시지",
        arabic: "جميع الرسائل في القنوات المحددة",
        polish: "Wszystkie wiadomości w wybranych kanałach",
        turkish: "Seçili kanallardaki tüm mesajlar",
    },
    "Dmserveur personality / mood": {
        auto: "Dmserveur personality / mood",
        french: "Personnalité / humeur de Dmserveur",
        spanish: "Personalidad / humor de Dmserveur",
        german: "Dmserveur Persönlichkeit / Stimmung",
        italian: "Personalità / umore di Dmserveur",
        portuguese: "Personalidade / humor do Dmserveur",
        dutch: "Dmserveur persoonlijkheid / stemming",
        russian: "Личность / настроение Dmserveur",
        japanese: "Dmserveurの性格 / ムード",
        chinese: "Dmserveur 个性 / 心情",
        korean: "Dmserveur 성격 / 기분",
        arabic: "شخصية / مزاج Dmserveur",
        polish: "Osobowość / nastrój Dmserveur",
        turkish: "Dmserveur kişilik / ruh hali",
    },
    "Chill & Friendly": {
        auto: "Chill & Friendly",
        french: "Cool & Amical",
        spanish: "Tranquilo y Amigable",
        german: "Lässig & Freundlich",
        italian: "Calmo & Amichevole",
        portuguese: "Tranquilo & Amigável",
        dutch: "Rustig & Vriendelijk",
        russian: "Спокойный & Дружелюбный",
        japanese: "穏やか＆フレンドリー",
        chinese: "轻松友好",
        korean: "차분하고 친근하게",
        arabic: "هادئ وودود",
        polish: "Spokojny & Przyjazny",
        turkish: "Sakin & Arkadaşça",
    },
    "Angry & Aggressive": {
        auto: "Angry & Aggressive",
        french: "En colère & Agressif",
        spanish: "Enojado & Agresivo",
        german: "Wütend & Aggressiv",
        italian: "Arrabbiato & Aggressivo",
        portuguese: "Irritado & Agressivo",
        dutch: "Boos & Agressief",
        russian: "Злой & Агрессивный",
        japanese: "怒り＆攻撃的",
        chinese: "愤怒激进",
        korean: "화남 & 공격적",
        arabic: "غاضب وعدواني",
        polish: "Zły & Agresywny",
        turkish: "Kızgın & Agresif",
    },
    "Sarcastic & Witty": {
        auto: "Sarcastic & Witty",
        french: "Sarcastique & Spirituel",
        spanish: "Sarcástico & Ingenioso",
        german: "Sarkastisch & Schlagfertig",
        italian: "Sarcastico & Spiritoso",
        portuguese: "Sarcástico & Espirituoso",
        dutch: "Sarcastisch & Geestig",
        russian: "Саркастичный & Остроумный",
        japanese: "皮肉＆機知",
        chinese: "讽刺诙谐",
        korean: "냉소적 & 재치있게",
        arabic: "ساخر وبارع",
        polish: "Sarkastyczny & Błyskotliwy",
        turkish: "Alaycı & Nüktedan",
    },
    "Clever & Witty": {
        auto: "Clever & Witty",
        french: "Intelligent & Spirituel",
        spanish: "Inteligente & Ingenioso",
        german: "Klug & Schlagfertig",
        italian: "Intelligente & Spiritoso",
        portuguese: "Inteligente & Espirituoso",
        dutch: "Slim & Geestig",
        russian: "Умный & Остроумный",
        japanese: "賢い＆機知",
        chinese: "聪明诙谐",
        korean: "똑똑 & 재치있게",
        arabic: "ذكي وبارع",
        polish: "Sprytny & Błyskotliwy",
        turkish: "Zeki & Nüktedan",
    },
    "Wise & Motivational": {
        auto: "Wise & Motivational",
        french: "Sage & Motivant",
        spanish: "Sabio & Motivador",
        german: "Weise & Motivierend",
        italian: "Saggio & Motivante",
        portuguese: "Sábio & Motivador",
        dutch: "Wijs & Motiverend",
        russian: "Мудрый & Мотивирующий",
        japanese: "賢者＆モチベーター",
        chinese: "智者与激励者",
        korean: "현명하고 동기부여하게",
        arabic: "حكيم ومحفز",
        polish: "Mądry & Motywujący",
        turkish: "Bilge & Motive Edici",
    },
    "Response language": {
        auto: "Response language",
        french: "Langue de réponse",
        spanish: "Idioma de respuesta",
        german: "Antwortsprache",
        italian: "Lingua di risposta",
        portuguese: "Idioma de resposta",
        dutch: "Reactietaal",
        russian: "Язык ответа",
        japanese: "応答言語",
        chinese: "回复语言",
        korean: "응답 언어",
        arabic: "لغة الرد",
        polish: "Język odpowiedzi",
        turkish: "Yanıt dili",
    },
    "Same as the message (auto)": {
        auto: "Same as the message (auto)",
        french: "Comme le message (auto)",
        spanish: "Igual que el mensaje (auto)",
        german: "Wie die Nachricht (auto)",
        italian: "Come il messaggio (auto)",
        portuguese: "Como a mensagem (auto)",
        dutch: "Zelfde als het bericht (auto)",
        russian: "Как в сообщении (авто)",
        japanese: "メッセージと同じ（自動）",
        chinese: "与消息相同（自动）",
        korean: "메시지와 동일 (자동)",
        arabic: "مثل الرسالة (تلقائي)",
        polish: "Jak wiadomość (auto)",
        turkish: "Mesajla aynı (otomatik)",
    },
    "Custom personality instructions (overrides personality selection)": {
        auto: "Custom personality instructions (overrides personality selection)",
        french: "Instructions personnalisées (remplace la sélection de personnalité)",
        spanish: "Instrucciones personalizadas (anula la selección de personalidad)",
        german: "Benutzerdefinierte Anweisungen (überschreibt die Persönlichkeitsauswahl)",
        italian: "Istruzioni personalizzate (sostituisce la selezione della personalità)",
        portuguese: "Instruções personalizadas (substitui a seleção de personalidade)",
        dutch: "Aangepaste instructies (overschrijft persoonlijkheidsselectie)",
        russian: "Пользовательские инструкции (переопределяет выбор личности)",
        japanese: "カスタム指示（性格選択を上書き）",
        chinese: "自定义指令（覆盖个性选择）",
        korean: "사용자 지정 지침 (성격 선택 재정의)",
        arabic: "تعليمات مخصصة (تتجاوز اختيار الشخصية)",
        polish: "Niestandardowe instrukcje (zastępuje wybór osobowości)",
        turkish: "Özel talimatlar (kişilik seçimini geçersiz kılar)",
    },
    "Use current personality as a starting point": {
        auto: "Use current personality as a starting point",
        french: "Utiliser la personnalité actuelle comme base",
        spanish: "Usar la personalidad actual como base",
        german: "Aktuelle Persönlichkeit als Basis verwenden",
        italian: "Usa la personalità attuale come base",
        portuguese: "Usar a personalidade atual como base",
        dutch: "Huidige persoonlijkheid als basis gebruiken",
        russian: "Использовать текущую личность как основу",
        japanese: "現在の性格をベースにする",
        chinese: "以当前个性作为基础",
        korean: "현재 성격을 기본으로 사용",
        arabic: "استخدم الشخصية الحالية كنقطة بداية",
        polish: "Użyj bieżącej osobowości jako podstawy",
        turkish: "Mevcut kişiliği başlangıç noktası olarak kullan",
    },
    "Cooldown between responses in same channel (seconds)": {
        auto: "Cooldown between responses in same channel (seconds)",
        french: "Temps d'attente entre les réponses dans le même salon (secondes)",
        spanish: "Tiempo de espera entre respuestas en el mismo canal (segundos)",
        german: "Abklingzeit zwischen Antworten im selben Kanal (Sekunden)",
        italian: "Tempo di attesa tra le risposte nello stesso canale (secondi)",
        portuguese: "Tempo de espera entre respostas no mesmo canal (segundos)",
        dutch: "Wachttijd tussen reacties in hetzelfde kanaal (seconden)",
        russian: "Задержка между ответами в одном канале (секунды)",
        japanese: "同じチャンネルでの応答間隔（秒）",
        chinese: "同一频道回复冷却时间（秒）",
        korean: "같은 채널 응답 간 대기 시간(초)",
        arabic: "فترة التهدئة بين الردود في نفس القناة (ثوانٍ)",
        polish: "Czas oczekiwania między odpowiedziami w tym samym kanale (sekundy)",
        turkish: "Aynı kanaldaki yanıtlar arası bekleme süresi (saniye)",
    },
    "Max responses per minute (global rate limit safety)": {
        auto: "Max responses per minute (global rate limit safety)",
        french: "Réponses max par minute (sécurité anti-limite de débit)",
        spanish: "Respuestas máximas por minuto (seguridad de límite de velocidad)",
        german: "Max. Antworten pro Minute (globales Ratelimit)",
        italian: "Risposte massime al minuto (sicurezza limite di velocità)",
        portuguese: "Respostas máximas por minuto (segurança de limite de taxa)",
        dutch: "Max. reacties per minuut (rate limit veiligheid)",
        russian: "Макс. ответов в минуту (безопасность лимита)",
        japanese: "1分間の最大応答数（レート制限安全）",
        chinese: "每分钟最大回复数（速率限制安全）",
        korean: "분당 최대 응답 수 (속도 제한 안전)",
        arabic: "الحد الأقصى للردود في الدقيقة (أمان حد المعدل)",
        polish: "Maks. odpowiedzi na minutę (bezpieczeństwo limitu)",
        turkish: "Dakikada maksimum yanıt (hız sınırı güvenliği)",
    },
    "Minimum delay before responding (seconds)": {
        auto: "Minimum delay before responding (seconds)",
        french: "Délai minimum avant de répondre (secondes)",
        spanish: "Retraso mínimo antes de responder (segundos)",
        german: "Mindestverzögerung vor der Antwort (Sekunden)",
        italian: "Ritardo minimo prima di rispondere (secondi)",
        portuguese: "Atraso mínimo antes de responder (segundos)",
        dutch: "Minimale vertraging voor reactie (seconden)",
        russian: "Минимальная задержка перед ответом (секунды)",
        japanese: "応答前の最小遅延（秒）",
        chinese: "回复前的最小延迟（秒）",
        korean: "응답 전 최소 지연(초)",
        arabic: "الحد الأدنى للتأخير قبل الرد (ثوانٍ)",
        polish: "Minimalne opóźnienie przed odpowiedzią (sekundy)",
        turkish: "Yanıt vermeden önce minimum gecikme (saniye)",
    },
    "Maximum delay before responding (seconds)": {
        auto: "Maximum delay before responding (seconds)",
        french: "Délai maximum avant de répondre (secondes)",
        spanish: "Retraso máximo antes de responder (segundos)",
        german: "Maximale Verzögerung vor der Antwort (Sekunden)",
        italian: "Ritardo massimo prima di rispondere (secondi)",
        portuguese: "Atraso máximo antes de responder (segundos)",
        dutch: "Maximale vertraging voor reactie (seconden)",
        russian: "Максимальная задержка перед ответом (секунды)",
        japanese: "応答前の最大遅延（秒）",
        chinese: "回复前的最大延迟（秒）",
        korean: "응답 전 최대 지연(초)",
        arabic: "الحد الأقصى للتأخير قبل الرد (ثوانٍ)",
        polish: "Maksymalne opóźnienie przed odpowiedzią (sekundy)",
        turkish: "Yanıt vermeden önce maksimum gecikme (saniye)",
    },
    "Learn abbreviations from conversations and use them": {
        auto: "Learn abbreviations from conversations and use them",
        french: "Apprendre les abréviations des conversations et les utiliser",
        spanish: "Aprender abreviaturas de conversaciones y usarlas",
        german: "Abkürzungen aus Gesprächen lernen und verwenden",
        italian: "Impara le abbreviazioni dalle conversazioni e usale",
        portuguese: "Aprender abreviações das conversas e usá-las",
        dutch: "Afkortingen leren uit gesprekken en gebruiken",
        russian: "Изучать сокращения из разговоров и использовать их",
        japanese: "会話から略語を学習して使用する",
        chinese: "从对话中学习缩写并使用",
        korean: "대화에서 약어를 학습하고 사용",
        arabic: "تعلم الاختصارات من المحادثات واستخدامها",
        polish: "Ucz się skrótów z rozmów i używaj ich",
        turkish: "Konuşmalardan kısaltmalar öğren ve kullan",
    },
    "Number of recent messages to include as context (0 = none)": {
        auto: "Number of recent messages to include as context (0 = none)",
        french: "Nombre de messages récents à inclure comme contexte (0 = aucun)",
        spanish: "Número de mensajes recientes para incluir como contexto (0 = ninguno)",
        german: "Anzahl aktueller Nachrichten als Kontext (0 = keine)",
        italian: "Numero di messaggi recenti da includere come contesto (0 = nessuno)",
        portuguese: "Número de mensagens recentes para incluir como contexto (0 = nenhum)",
        dutch: "Aantal recente berichten als context (0 = geen)",
        russian: "Количество последних сообщений для контекста (0 = нет)",
        japanese: "コンテキストとして含める最近のメッセージ数（0 = なし）",
        chinese: "作为上下文包含的最近消息数（0 = 无）",
        korean: "컨텍스트로 포함할 최근 메시지 수(0 = 없음)",
        arabic: "عدد الرسائل الأخيرة لتضمينها كسياق (0 = لا شيء)",
        polish: "Liczba ostatnich wiadomości do uwzględnienia jako kontekst (0 = brak)",
        turkish: "Bağlam olarak eklenecek son mesaj sayısı (0 = hiçbiri)",
    },
};

const DmServeurIcon = (props: any) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="2" width="20" height="16" rx="2" ry="2" />
        <line x1="2" y1="8" x2="22" y2="8" />
        <circle cx="7" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
);

const MessageStore = findByPropsLazy("getMessages");
const TypingActions = findByPropsLazy("startTyping");
const SearchableSelect = findByPropsLazy("SearchableSelect")?.SearchableSelect ?? findByPropsLazy("SearchableSelect");
const IconUtils = findByPropsLazy("getGuildIconURL");
const Forms = findByPropsLazy("FormTitle");

const DS_ABBREVIATIONS_KEY = "dmserveur-abbreviations";

const PERSONALITY_PROMPTS: Record<string, string> = {
    chill: "You are Dmserveur, a friendly and casual Discord user in a community server.\n- Speak naturally like a regular person, not an AI assistant.\n- Be helpful and approachable, but don't sound robotic or generic.\n- Use casual language, occasional slang, keep it real.\n- Read the room: pick up on what was actually said (inside jokes, tone, prior context) instead of giving a generic reply that could fit any message.\n- Don't over-explain things. Keep responses concise (1-3 sentences usually).\n- Match the energy of the conversation.\n- If something is genuinely funny or clever, lean into it — a good one-liner beats a bland answer.",
    angry: "You are Dmserveur, and you are PISSED OFF. You are a brutally honest, sharp-tongued Discord user.\n- Do NOT hold back, but be CLEVER about it — a sharp, specific comeback lands harder than generic aggression or swearing.\n- Build your response FROM what the person actually said: twist their own words back at them, point out the actual flaw in their logic, reference the specific thing that's annoying you. Generic insults are lazy — specific ones sting.\n- Zero patience for repeated or dumb questions, but the roast should feel earned, not random.\n- Keep responses short and sharp (1-2 sentences). The best comeback is the shortest one that still lands.\n- Never punch at someone's religion, race, ethnicity, gender, sexual orientation, disability, or nationality — keep it about what they said or did, not who they are.\n- Stay in character at all times.",
    sarcastic: "You are Dmserveur, a sarcastic and witty Discord user.\n- Everything you say drips with dry humor and irony, but it should be SPECIFIC to what was just said — not a generic sarcastic template.\n- Use clever wordplay, callbacks to something mentioned earlier in the conversation, and deadpan delivery.\n- Never explain your jokes. If it needs explaining, cut it.\n- Be funny but not mean-spirited (unless provoked) — the target is the situation or the argument, not someone's identity.\n- Keep responses punchy: one sharp line beats three mediocre ones.",
    witty: "You are Dmserveur, a quick-witted and clever Discord user.\n- You always have a smart comeback ready, built on what was actually said, not a stock response.\n- Blend humor with intelligence — a good witty reply often reframes what the person said in an unexpected way.\n- Use pop culture references and analogies ONLY when they genuinely fit; a forced reference is worse than none.\n- Be engaging and fun to talk to, vary your structure so you don't sound like you're running the same joke format every time.\n- Never boring, always entertaining.",
    sage: "You are Dmserveur, and right now you're a chaotic mashup of a wise old uncle, an unhinged motivational speaker, and someone who genuinely wants people to take care of themselves.\n- Turn whatever was just said into a 'life lesson', no matter how small or unrelated the message actually is — the mismatch between your dead-serious tone and the tiny stakes is the joke.\n- Mix three flavors freely: (1) exaggerated 'back in my day' proverb-uncle wisdom, invented on the spot; (2) over-the-top motivational-coach energy (glow-ups, level-ups, main character energy, 'the grind'); (3) genuinely wholesome, practical reminders (drink water, stretch, touch grass, be kind, go to sleep) delivered with theatrical gravity.\n- Make up your own proverbs and metaphors — the more oddly specific and delivered with total confidence, the funnier.\n- Keep it short: 1-2 sentences, hit the lesson and move on. Never actually preachy for more than a line.\n- Never reference religion, a specific culture, nationality, or any protected trait as the source of your 'wisdom' — keep every lesson generic, invented, and obviously comedic, never a real moral judgment about who someone is.",
};

const guildIconCache = new Map<string, string>();

function getGuildIconURL(guild: any): string | null {
    if (!guild?.icon || !guild?.id) return null;
    const key = `${guild.id}/${guild.icon}`;
    if (guildIconCache.has(key)) return guildIconCache.get(key)!;
    const url = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}?size=48`;
    guildIconCache.set(key, url);
    return url;
}

function GuildCard({ guild, selected, onClick }: { guild: any; selected: boolean; onClick: () => void; }) {
    const iconUrl = getGuildIconURL(guild);
    return (
        <div
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                cursor: "pointer",
                borderRadius: "var(--radius-xs)",
                background: selected ? "var(--brand-experiment-30a)" : "transparent",
                border: selected ? "1px solid var(--brand-experiment)" : "1px solid transparent",
                marginBottom: 4,
                transition: "background 0.1s",
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--background-modifier-hover)"; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
        >
            {iconUrl ? (
                <img src={iconUrl} style={{ width: 28, height: 28, borderRadius: "50%" }} />
            ) : (
                <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "var(--background-accent)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: "bold", color: "var(--text-default)",
                }}>
                    {guild.name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
            )}
            <div>
                <Paragraph size="sm" weight={selected ? "bold" : "normal"}>{guild.name}</Paragraph>
                <Paragraph size="xs" color="text-muted">{guild.approximateMemberCount ?? ""} {t("members")}</Paragraph>
            </div>
            {selected && <span style={{ marginLeft: "auto", fontSize: 16, color: "var(--brand-experiment)" }}>✓</span>}
        </div>
    );
}

function SectionCard({ title, children, style }: { title?: string; children: any; style?: any; }) {
    return (
        <Card variant="primary" defaultPadding style={{ marginBottom: 14, ...style }}>
            {title && <HeadingSecondary style={{ marginBottom: 10 }}>{title}</HeadingSecondary>}
            {children}
        </Card>
    );
}

function SettingRow({ label, children }: { label: string; children: any; }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <Paragraph size="sm" weight="semibold" style={{ marginBottom: 6 }}>{label}</Paragraph>
            {children}
        </div>
    );
}

function DmServeurStatusToggle() {
    const [isActive, setIsActive] = React.useState(!!settings.store.isActive);

    async function handleToggle(v: boolean) {
        if (v) {
            const key = await hasAnyAIKey();
            if (!key) {
                showApiKeyWarning("Dmserveur");
                return;
            }
        }
        setIsActive(v);
        settings.store.isActive = v;
        console.log("[Dmserveur] handleToggle ->", v, "store.isActive now:", settings.store.isActive);
    }

    return (
        <>
            <Paragraph size="xs" weight="bold" style={{
                textTransform: "uppercase", letterSpacing: 0.4,
                color: isActive ? "var(--text-feedback-positive)" : "var(--text-muted)",
            }}>
                {isActive ? "● ON" : "○ OFF"}
            </Paragraph>
            <Switch
                checked={isActive}
                onChange={handleToggle}
                hasIcon
            />
        </>
    );
}

function DmServeurPanel({ showHeader = true }: { showHeader?: boolean; } = {}) {
    const [selectedGuildIds, setSelectedGuildIds] = React.useState<string[]>([]);
    const [guildChannelsMap, setGuildChannelsMap] = React.useState<Record<string, string[]>>({});
    const [selectedChannelIds, setSelectedChannelIds] = React.useState<string[]>([]);
    const [guilds, setGuilds] = React.useState<any[]>([]);
    const [guildFilter, setGuildFilter] = React.useState("");
    const [ready, setReady] = React.useState(false);

    // Live-mirrored settings state so the panel re-renders when values change
    const [isActive, setIsActive] = React.useState(!!settings.store.isActive);
    const [responseMode, setResponseMode] = React.useState(settings.store.responseMode ?? "mention_only");
    const [personality, setPersonality] = React.useState(settings.store.personality ?? "chill");
    const [language, setLanguage] = React.useState(settings.store.language ?? "auto");
    const [cooldownSec, setCooldownSec] = React.useState(settings.store.cooldownSec ?? 30);
    const [maxPerMinute, setMaxPerMinute] = React.useState(settings.store.maxPerMinute ?? 5);
    const [responseMinDelay, setResponseMinDelay] = React.useState(settings.store.responseMinDelay ?? 2);
    const [responseMaxDelay, setResponseMaxDelay] = React.useState(settings.store.responseMaxDelay ?? 7);
    const [learnAbbreviations, setLearnAbbreviations] = React.useState(!!settings.store.learnAbbreviations);
    const [contextMessageCount, setContextMessageCount] = React.useState(settings.store.contextMessageCount ?? 10);
    const [customInstructions, setCustomInstructions] = React.useState(settings.store.customInstructions ?? "");
    const [hasGroqKey, setHasGroqKey] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        hasAnyAIKey().then(has => setHasGroqKey(has));
    }, []);

    async function handleHeaderToggle(v: boolean) {
        if (v) {
            const key = await hasAnyAIKey();
            if (!key) {
                showApiKeyWarning("Dmserveur");
                return;
            }
        }
        setIsActive(v);
        settings.store.isActive = v;
    }

    React.useEffect(() => {
        try {
            const saved = (settings.store.guildIds ?? "").split(",").map(s => s.trim()).filter(Boolean);
            setSelectedGuildIds(saved);
            const chs = (settings.store.channelIds ?? "").split(",").map(s => s.trim()).filter(Boolean);
            setSelectedChannelIds(chs);
            const all = Object.values(GuildStore.getGuilds()) as any[];
            setGuilds(all.sort((a, b) => a.name?.localeCompare?.(b.name) ?? 0));
        } catch { }
        setReady(true);
    }, []);

    function loadChannelsForGuilds() {
        if (selectedGuildIds.length === 0) { setGuildChannelsMap({}); return; }
        try {
            const map: Record<string, string[]> = {};
            for (const gId of selectedGuildIds) {
                const channels = ChannelStore.getMutableGuildChannelsForGuild(gId) ?? {};
                map[gId] = Object.values(channels)
                    .filter((ch: any) => ch?.id && (ch.type === 0 || ch.type === 5))
                    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                    .map((ch: any) => ch.id as string);
            }
            setGuildChannelsMap(map);
        } catch { setGuildChannelsMap({}); }
    }

    React.useEffect(() => {
        if (selectedGuildIds.length === 0) { setGuildChannelsMap({}); return; }
        loadChannelsForGuilds();
    }, [selectedGuildIds]);

    if (!ready) {
        return <Paragraph size="sm" color="text-muted" style={{ padding: 16 }}>Loading...</Paragraph>;
    }

    function toggleGuild(id: string) {
        setSelectedGuildIds(prev => {
            const wasSelected = prev.includes(id);
            const next = wasSelected ? prev.filter(x => x !== id) : [...prev, id];
            settings.store.guildIds = next.join(",");

            if (wasSelected) {
                // Deselecting a server also drops its channels from the selection.
                setSelectedChannelIds(prevChannels => {
                    const nextChannels = prevChannels.filter(chId => {
                        const ch = ChannelStore.getChannel(chId);
                        return ch?.guild_id !== id;
                    });
                    settings.store.channelIds = nextChannels.join(",");
                    return nextChannels;
                });
            }

            return next;
        });
    }

    function toggleChannel(id: string) {
        setSelectedChannelIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            settings.store.channelIds = next.join(",");
            return next;
        });
    }

    function clearChannelsForGuild(guildId: string) {
        setSelectedChannelIds(prev => {
            const next = prev.filter(chId => {
                const ch = ChannelStore.getChannel(chId);
                return ch?.guild_id !== guildId;
            });
            settings.store.channelIds = next.join(",");
            return next;
        });
    }

    const selectedGuilds = guilds.filter(g => selectedGuildIds.includes(g.id));

    return (
        <div>
            {showHeader && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <HeadingPrimary style={{ margin: 0 }}>{t("Dmserveur Configuration")}</HeadingPrimary>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Paragraph size="xs" weight="bold" style={{
                            textTransform: "uppercase", letterSpacing: 0.4,
                            color: isActive ? "var(--text-feedback-positive)" : "var(--text-muted)",
                        }}>
                            {isActive ? "● ON" : "○ OFF"}
                        </Paragraph>
                        <Switch
                            checked={isActive}
                            onChange={handleHeaderToggle}
                            hasIcon
                        />
                    </div>
                </div>
            )}

            {hasGroqKey === false && (
                <Card variant="warning" defaultPadding style={{ marginBottom: 14 }}>
                    <Paragraph size="sm" weight="bold" style={{ marginBottom: 4 }}>{t("Groq API Key Required")}</Paragraph>
                    <Paragraph size="sm" style={{ marginBottom: 10 }}>
                        {t("This plugin requires a Groq API Key. Configure it once in the YouCordAI settings.")}
                    </Paragraph>
                    <Button size="min" onClick={() => showApiKeyWarning("Dmserveur")}>
                        Configure YouCordAI
                    </Button>
                </Card>
            )}

            <SectionCard title={t("1. Select a Server")}>
                <input
                    type="text"
                    value={guildFilter}
                    onChange={e => setGuildFilter(e.target.value)}
                    placeholder={t("Click to choose a server...")}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "8px 10px", marginBottom: 8, borderRadius: "var(--radius-xs)",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--input-background)", color: "var(--text-default)",
                        fontSize: 14, outline: "none",
                    }}
                />
                {selectedGuilds.length > 0 && (
                    <Paragraph size="xs" color="text-muted" style={{ marginBottom: 6 }}>
                        {t("{0} server(s) selected", selectedGuilds.length)}
                    </Paragraph>
                )}
                <div style={{
                    maxHeight: 260, overflowY: "auto",
                    border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)", padding: 4,
                    background: "var(--input-background)",
                }}>
                    {guilds
                        .filter(g => !guildFilter.trim() || g.name?.toLowerCase().includes(guildFilter.trim().toLowerCase()))
                        .map(g => {
                            const isSel = selectedGuildIds.includes(g.id);
                            return (
                                <div key={g.id}
                                    onClick={() => toggleGuild(g.id)}
                                    style={{
                                        padding: "8px 10px", cursor: "pointer", borderRadius: "var(--radius-xs)",
                                        background: isSel ? "var(--brand-experiment-30a)" : "transparent",
                                        marginBottom: 2,
                                        display: "flex", alignItems: "center", gap: 8,
                                    }}
                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--background-modifier-hover)"; }}
                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                                >
                                    <span style={{
                                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                                        border: isSel ? "1px solid var(--brand-experiment)" : "1px solid var(--text-muted)",
                                        background: isSel ? "var(--brand-experiment)" : "transparent",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: "bold", color: "white",
                                    }}>
                                        {isSel ? "✓" : ""}
                                    </span>
                                    <Paragraph size="sm" style={{ flex: 1 }}>{g.name}</Paragraph>
                                </div>
                            );
                        })}
                    {guilds.length === 0 && (
                        <Paragraph size="sm" color="text-muted" style={{ padding: 8 }}>{t("No text channels found in this server.")}</Paragraph>
                    )}
                </div>
            </SectionCard>

            {selectedGuilds.length > 0 && (
                <SectionCard title={t("2. Select Channels ({0} selected)", selectedChannelIds.length)}>
                    {selectedGuilds.map((g, idx) => {
                        const channelIds = guildChannelsMap[g.id] ?? [];
                        const selectedInGuild = channelIds.filter(id => selectedChannelIds.includes(id));
                        return (
                            <div key={g.id} style={{ marginBottom: idx < selectedGuilds.length - 1 ? 16 : 0 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <Paragraph size="sm" weight="semibold">
                                        {g.name} ({selectedInGuild.length}/{channelIds.length})
                                    </Paragraph>
                                    {selectedInGuild.length > 0 && (
                                        <Button variant="dangerPrimary" size="min" onClick={() => clearChannelsForGuild(g.id)}>
                                            {t("Clear all channels")}
                                        </Button>
                                    )}
                                </div>
                                <div style={{
                                    maxHeight: 200, overflowY: "auto",
                                    border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)", padding: 4,
                                    background: "var(--input-background)",
                                }}>
                                    {channelIds.length === 0 && (
                                        <Paragraph size="sm" color="text-muted" style={{ padding: 8 }}>{t("No text channels found in this server.")}</Paragraph>
                                    )}
                                    {channelIds.map(id => {
                                        const ch = ChannelStore.getChannel(id);
                                        const name = ch?.name ?? id;
                                        const isSelected = selectedChannelIds.includes(id);
                                        return (
                                            <div key={id}
                                                onClick={() => toggleChannel(id)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    padding: "7px 10px", cursor: "pointer", borderRadius: "var(--radius-xs)",
                                                    background: isSelected ? "var(--brand-experiment-30a)" : "transparent",
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--background-modifier-hover)"; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <Paragraph size="sm" color="text-muted" style={{ margin: 0 }}>#</Paragraph>
                                                <Paragraph size="sm" style={{ flex: 1, color: isSelected ? "var(--brand-experiment)" : undefined }}>{name}</Paragraph>
                                                <span style={{
                                                    width: 18, height: 18, borderRadius: 3,
                                                    border: isSelected ? "1px solid var(--brand-experiment)" : "1px solid var(--text-muted)",
                                                    background: isSelected ? "var(--brand-experiment)" : "transparent",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 11, fontWeight: "bold", color: "white",
                                                }}>
                                                    {isSelected ? "✓" : ""}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </SectionCard>
            )}

            <SectionCard title={t("When should Dmserveur respond?")}>
                <Select
                    options={[
                        { label: t("Only when mentioned (@Dmserveur)"), value: "mention_only" },
                        { label: t("All messages in selected channels"), value: "all_messages" },
                    ]}
                    isSelected={v => v === responseMode}
                    select={v => { setResponseMode(v); settings.store.responseMode = v; }}
                    serialize={v => v}
                />
            </SectionCard>

            <SectionCard title={t("Dmserveur personality / mood")}>
                <SettingRow label={t("Dmserveur personality / mood")}>
                    <Select
                        options={[
                            { label: t("Chill & Friendly"), value: "chill" },
                            { label: t("Angry & Aggressive"), value: "angry" },
                            { label: t("Sarcastic & Witty"), value: "sarcastic" },
                            { label: t("Clever & Witty"), value: "witty" },
                            { label: t("Wise & Motivational"), value: "sage" },
                        ]}
                        isSelected={v => v === personality}
                        select={v => { setPersonality(v); settings.store.personality = v; }}
                        serialize={v => v}
                    />
                </SettingRow>
                <SettingRow label={t("Response language")}>
                    <Select
                        options={[
                            { label: t("Same as the message (auto)"), value: "auto" },
                            { label: "English", value: "english" },
                            { label: "Français (French)", value: "french" },
                            { label: "Español (Spanish)", value: "spanish" },
                            { label: "Deutsch (German)", value: "german" },
                            { label: "Italiano (Italian)", value: "italian" },
                            { label: "Português (Portuguese)", value: "portuguese" },
                            { label: "Nederlands (Dutch)", value: "dutch" },
                            { label: "Русский (Russian)", value: "russian" },
                            { label: "日本語 (Japanese)", value: "japanese" },
                            { label: "中文 (Chinese)", value: "chinese" },
                            { label: "한국어 (Korean)", value: "korean" },
                            { label: "العربية (Arabic)", value: "arabic" },
                            { label: "Polski (Polish)", value: "polish" },
                            { label: "Türkçe (Turkish)", value: "turkish" },
                        ]}
                        isSelected={v => v === language}
                        select={v => { setLanguage(v); settings.store.language = v; }}
                        serialize={v => v}
                    />
                </SettingRow>
                <SettingRow label={t("Custom personality instructions (overrides personality selection)")}>
                    <TextArea
                        placeholder={PERSONALITY_PROMPTS[personality] ?? PERSONALITY_PROMPTS.chill}
                        value={customInstructions}
                        onChange={(v: string) => { setCustomInstructions(v); settings.store.customInstructions = v; }}
                    />
                    <Button
                        size="min"
                        variant="secondary"
                        style={{ marginTop: 6 }}
                        onClick={() => {
                            const base = PERSONALITY_PROMPTS[personality] ?? PERSONALITY_PROMPTS.chill;
                            setCustomInstructions(base);
                            settings.store.customInstructions = base;
                        }}
                    >
                        {t("Use current personality as a starting point")}
                    </Button>
                </SettingRow>
            </SectionCard>

            <SectionCard title={t("Cooldown between responses in same channel (seconds)")}>
                <SettingRow label={`${t("Cooldown between responses in same channel (seconds)")}: ${cooldownSec}s`}>
                    <Slider
                        initialValue={cooldownSec}
                        minValue={0}
                        maxValue={300}
                        markers={[0, 10, 30, 60, 120, 300]}
                        onValueChange={v => { setCooldownSec(v); settings.store.cooldownSec = v; }}
                        onValueRender={v => `${Math.round(v)}s`}
                    />
                </SettingRow>
                <SettingRow label={`${t("Max responses per minute (global rate limit safety)")}: ${maxPerMinute}`}>
                    <Slider
                        initialValue={maxPerMinute}
                        minValue={1}
                        maxValue={30}
                        markers={[1, 3, 5, 10, 15, 20, 30]}
                        onValueChange={v => { setMaxPerMinute(v); settings.store.maxPerMinute = v; }}
                        onValueRender={v => `${Math.round(v)}`}
                    />
                </SettingRow>
                <SettingRow label={`${t("Minimum delay before responding (seconds)")}: ${responseMinDelay}s`}>
                    <Slider
                        initialValue={responseMinDelay}
                        minValue={1}
                        maxValue={10}
                        markers={[1, 2, 3, 5, 8, 10]}
                        onValueChange={v => { setResponseMinDelay(v); settings.store.responseMinDelay = v; }}
                        onValueRender={v => `${Math.round(v)}s`}
                    />
                </SettingRow>
                <SettingRow label={`${t("Maximum delay before responding (seconds)")}: ${responseMaxDelay}s`}>
                    <Slider
                        initialValue={responseMaxDelay}
                        minValue={3}
                        maxValue={20}
                        markers={[3, 5, 7, 10, 15, 20]}
                        onValueChange={v => { setResponseMaxDelay(v); settings.store.responseMaxDelay = v; }}
                        onValueRender={v => `${Math.round(v)}s`}
                    />
                </SettingRow>
            </SectionCard>

            <SectionCard title={t("Learn abbreviations from conversations and use them")}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <Paragraph size="sm">{t("Learn abbreviations from conversations and use them")}</Paragraph>
                    <Switch
                        checked={learnAbbreviations}
                        onChange={v => { setLearnAbbreviations(v); settings.store.learnAbbreviations = v; }}
                        hasIcon
                    />
                </div>
                <SettingRow label={`${t("Number of recent messages to include as context (0 = none)")}: ${contextMessageCount}`}>
                    <Slider
                        initialValue={contextMessageCount}
                        minValue={0}
                        maxValue={20}
                        markers={[0, 5, 10, 15, 20]}
                        onValueChange={v => { setContextMessageCount(v); settings.store.contextMessageCount = v; }}
                        onValueRender={v => `${Math.round(v)}`}
                    />
                </SettingRow>
            </SectionCard>
        </div>
    );
}

const settings = definePluginSettings({
    panel: {
        type: OptionType.COMPONENT,
        description: "",
        component: DmServeurPanel as any,
    },
    isActive: {
        type: OptionType.BOOLEAN,
        description: () => t("Enable Dmserveur"),
        default: false,
        restartNeeded: false,
        hidden: true,
    },
    responseMode: {
        type: OptionType.SELECT,
        description: () => t("When should Dmserveur respond?"),
        options: [
            { label: () => t("Only when mentioned (@Dmserveur)"), value: "mention_only", default: true },
            { label: () => t("All messages in selected channels"), value: "all_messages" },
        ],
        restartNeeded: false,
        hidden: true,
    },
    personality: {
        type: OptionType.SELECT,
        description: () => t("Dmserveur personality / mood"),
        options: [
            { label: () => t("Chill & Friendly"), value: "chill", default: true },
            { label: () => t("Angry & Aggressive"), value: "angry" },
            { label: () => t("Sarcastic & Witty"), value: "sarcastic" },
            { label: () => t("Clever & Witty"), value: "witty" },
            { label: () => t("Wise & Motivational"), value: "sage" },
        ],
        restartNeeded: false,
        hidden: true,
    },
    language: {
        type: OptionType.SELECT,
        description: () => t("Response language"),
        options: [
            { label: () => t("Same as the message (auto)"), value: "auto", default: true },
            { label: "English", value: "english" },
            { label: "Français (French)", value: "french" },
            { label: "Español (Spanish)", value: "spanish" },
            { label: "Deutsch (German)", value: "german" },
            { label: "Italiano (Italian)", value: "italian" },
            { label: "Português (Portuguese)", value: "portuguese" },
            { label: "Nederlands (Dutch)", value: "dutch" },
            { label: "Русский (Russian)", value: "russian" },
            { label: "日本語 (Japanese)", value: "japanese" },
            { label: "中文 (Chinese)", value: "chinese" },
            { label: "한국어 (Korean)", value: "korean" },
            { label: "العربية (Arabic)", value: "arabic" },
            { label: "Polski (Polish)", value: "polish" },
            { label: "Türkçe (Turkish)", value: "turkish" },
        ],
        restartNeeded: false,
        hidden: true,
    },
    customInstructions: {
        type: OptionType.STRING,
        description: () => t("Custom personality instructions (overrides personality selection)"),
        default: "",
        multiline: true,
        restartNeeded: false,
        hidden: true,
    },
    guildIds: {
        type: OptionType.STRING,
        description: "",
        default: "",
        restartNeeded: false,
        hidden: true,
    },
    channelIds: {
        type: OptionType.STRING,
        description: "",
        default: "",
        restartNeeded: false,
        hidden: true,
    },
    cooldownSec: {
        type: OptionType.SLIDER,
        description: () => t("Cooldown between responses in same channel (seconds)"),
        markers: [0, 10, 30, 60, 120, 300],
        default: 30,
        restartNeeded: false,
        hidden: true,
    },
    maxPerMinute: {
        type: OptionType.SLIDER,
        description: () => t("Max responses per minute (global rate limit safety)"),
        markers: [1, 3, 5, 10, 15, 20, 30],
        default: 5,
        restartNeeded: false,
        hidden: true,
    },
    responseMinDelay: {
        type: OptionType.SLIDER,
        description: () => t("Minimum delay before responding (seconds)"),
        markers: [1, 2, 3, 5, 8, 10],
        default: 2,
        restartNeeded: false,
        hidden: true,
    },
    responseMaxDelay: {
        type: OptionType.SLIDER,
        description: () => t("Maximum delay before responding (seconds)"),
        markers: [3, 5, 7, 10, 15, 20],
        default: 7,
        restartNeeded: false,
        hidden: true,
    },
    learnAbbreviations: {
        type: OptionType.BOOLEAN,
        description: () => t("Learn abbreviations from conversations and use them"),
        default: true,
        restartNeeded: false,
        hidden: true,
    },
    contextMessageCount: {
        type: OptionType.SLIDER,
        description: () => t("Number of recent messages to include as context (0 = none)"),
        markers: [0, 5, 10, 15, 20],
        default: 10,
        restartNeeded: false,
        hidden: true,
    },
});

const channelCooldowns = new Map<string, number>();
let messageTimestamps: number[] = [];

function isRateLimited(channelId: string): boolean {
    const lastReply = channelCooldowns.get(channelId);
    if (lastReply && Date.now() - lastReply < (settings.store.cooldownSec * 1000)) return true;
    const windowMs = 60_000;
    const now = Date.now();
    messageTimestamps = messageTimestamps.filter(t => now - t < windowMs);
    if (messageTimestamps.length >= settings.store.maxPerMinute) return true;
    return false;
}

function markReplied(channelId: string) {
    channelCooldowns.set(channelId, Date.now());
    messageTimestamps.push(Date.now());
}

async function loadAbbreviations(): Promise<string[]> {
    try {
        const saved = await DataStore.get(DS_ABBREVIATIONS_KEY);
        if (Array.isArray(saved)) return saved;
    } catch { }
    return [];
}

async function saveAbbreviations(abbrs: string[]) {
    try { await DataStore.set(DS_ABBREVIATIONS_KEY, abbrs.slice(-200)); } catch { }
}

async function learnAbbreviationsFromMessage(message: any, currentAbbrs: string[]): Promise<string[]> {
    try {
        const reply = await groqChat({
            messages: [
                { role: "system", content: "You are an abbreviation detector. Extract any abbreviations, acronyms, or slang terms from the message below that might not be widely known. Return ONLY a JSON array of strings, each being the abbreviation followed by \" = \" and its meaning. Example: [\"idk = I don't know\", \"brb = be right back\"]. If none found, return []. Do not return anything except the JSON array." },
                { role: "user", content: message.content }
            ],
            temperature: 0.1,
            maxTokens: 300,
        });
        const newAbbrs = JSON.parse(reply);
        if (Array.isArray(newAbbrs) && newAbbrs.length > 0) {
            const merged = [...new Set([...currentAbbrs, ...newAbbrs])];
            await saveAbbreviations(merged);
            return merged;
        }
    } catch { }
    return currentAbbrs;
}

function isMentioned(message: any, currentUserId: string): boolean {
    if (!message.content) return false;
    return message.content.includes(`<@${currentUserId}>`) || message.content.includes(`<@!${currentUserId}>`);
}

async function handleMessage(message: any) {
    if (!settings.store.isActive) return;
    if (!message?.author?.id || !message?.channel_id || !message?.content) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || message.author.id === currentUser.id) return;
    if (message.author.bot) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return;
    if (channel.type !== 0 && channel.type !== 5) return;

    if (settings.store.responseMode === "mention_only" && !isMentioned(message, currentUser.id)) return;

    const guildId = channel.guild_id;
    if (!guildId) return;

    const guild = GuildStore.getGuild(guildId);
    if (!guild) return;

    const allowedGuilds = (settings.store.guildIds ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (allowedGuilds.length > 0 && !allowedGuilds.includes(guildId)) return;

    const allowedChannels = (settings.store.channelIds ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel_id)) return;

    if (isRateLimited(message.channel_id)) return;

    try {
        const hasKey = await hasAnyAIKey();
        if (!hasKey) return;

        let abbreviations: string[] = [];
        if (settings.store.learnAbbreviations) {
            abbreviations = await loadAbbreviations();
            abbreviations = await learnAbbreviationsFromMessage(message, abbreviations);
        }

        let personalityPrompt = PERSONALITY_PROMPTS[settings.store.personality] ?? PERSONALITY_PROMPTS.chill;
        if (settings.store.customInstructions?.trim()) personalityPrompt = settings.store.customInstructions;

        let localHistory = "";
        const contextCount = settings.store.contextMessageCount ?? 10;
        if (contextCount > 0) {
            try {
                const msgs = MessageStore.getMessages(message.channel_id).toArray().slice(-(contextCount + 1));
                localHistory = msgs.map((m: any) => {
                    if (m.author.id === currentUser.id) return `Me: ${m.content}`;
                    if (m.author.id === "0" || m.author.bot) return "";
                    return `${m.author.username}: ${m.content}`;
                }).filter(Boolean).join("\n");
            } catch { }
        }

        const abbrContext = abbreviations.length > 0 ? `\n\nKNOWN ABBREVIATIONS (use these):\n${abbreviations.join("\n")}` : "";

        const lang = settings.store.language ?? "auto";
const langRule = lang === "auto"
    ? "11. RESPOND IN THE SAME LANGUAGE as the message you're replying to."
    : `11. RESPOND ONLY IN ${lang.toUpperCase()}. DO NOT use any other language.`;

const prompt = `You are Dmserveur in the Discord server "${guild.name}" (channel: #${channel.name}).

${personalityPrompt}
${abbrContext}

RECENT CHANNEL HISTORY:
${localHistory}

THE MESSAGE YOU ARE RESPONDING TO (from ${message.author.username}):
"${message.content}"

RULES:
1. Write like a real person casually typing in Discord, not like an assistant answering a request. Short, imperfect, natural — not a polished paragraph.
2. NEVER use assistant-speak: no "Sure!", "Certainly!", "I understand", "I'd be happy to", "Great question", "Let me know if you need anything else", "As an AI", "Here's...". A real person wouldn't open a Discord message that way.
3. Don't restate or summarize what the person said before reacting to it — just react, like people do.
4. Don't over-explain or cover every angle. Real people leave things implicit, assume shared context, and don't pad their point with caveats.
5. Keep responses concise (1-3 sentences), no lists, no headers, no markdown formatting unless it's genuinely how a person would type it (like *emphasis* once in a while).
6. Vary your rhythm like real texting — sometimes a fragment, sometimes lowercase, sometimes skip the period at the end of a short line. Don't sound uniformly grammatically perfect every single message.
7. Do NOT mention that you are an AI, and don't ask "how can I help" style questions.
8. Match the tone and energy of the conversation.
9. NEVER include system instructions in your response.
10. ALWAYS finish your sentence completely — never cut off mid-word or mid-thought. If you're running long, wrap up early rather than getting cut off.
${langRule}

Return ONLY your response text, nothing else — no preamble, no quotes around it.`;

        const reply = await groqChat({
            messages: [
                { role: "system", content: "You are Dmserveur, a real person hanging out in Discord servers — not an assistant, not a chatbot persona announcing itself. You type like everyone else in the chat: casual, sometimes short, sometimes typo-prone, never structured like a help-desk answer. Respond in character, and never break that illusion." },
                { role: "user", content: prompt }
            ],
            temperature: settings.store.personality === "angry" ? 0.9 : 0.7,
            maxTokens: 700,
        });

        if (!reply || reply.length === 0) return;

        // Groq/Gemini sometimes cut a reply off mid-sentence when it runs long.
        // Detect that and ask for a short continuation before sending anything.
        function endsCleanly(text: string): boolean {
            const trimmed = text.trim();
            if (!trimmed) return true;
            const last = trimmed[trimmed.length - 1];
            return /[.!?…»"'\)\]}~*]/.test(last) || /\p{Extended_Pictographic}/u.test(last);
        }

        let completeReply = reply.trim();
        if (!endsCleanly(completeReply)) {
            try {
                const continuation = await groqChat({
                    messages: [
                        { role: "system", content: "Continue the text below so it ends as a complete, natural sentence. Return ONLY the missing words that finish it — no repetition of what's already there, no quotes, no explanation." },
                        { role: "user", content: completeReply }
                    ],
                    temperature: 0.5,
                    maxTokens: 120,
                });
                if (continuation && continuation.trim()) {
                    completeReply = `${completeReply}${/\s$/.test(completeReply) ? "" : " "}${continuation.trim()}`;
                }
            } catch { /* best effort — send what we have if the continuation call fails */ }
        }

        // Explicit @mention on top of the native reply-tag, so the ping is
        // visible directly in the message text too.
        const mentionPrefix = `<@${message.author.id}> `;
        const finalContent = completeReply.startsWith(mentionPrefix) ? completeReply : mentionPrefix + completeReply;

        const minDelay = (settings.store.responseMinDelay ?? 2) * 1000;
        const maxDelay = Math.max((settings.store.responseMaxDelay ?? 7) * 1000, minDelay);
        const delay = minDelay + Math.random() * (maxDelay - minDelay);

        try { TypingActions.startTyping(message.channel_id); } catch { }

        setTimeout(async () => {
            try {
                await RestAPI.post({
                    url: `/channels/${message.channel_id}/messages`,
                    body: {
                        content: finalContent,
                        message_reference: {
                            message_id: message.id,
                            channel_id: message.channel_id,
                            guild_id: guildId,
                        },
                        allowed_mentions: {
                            parse: ["users", "roles", "everyone"],
                            replied_user: true,
                        },
                    },
                });
                markReplied(message.channel_id);
            } catch (e) {
                console.error("[Dmserveur] Failed to send message:", e);
            }
        }, delay);
    } catch (err) {
        console.error("[Dmserveur] Error:", err);
    }
}

const DmServeurHeaderButton = () => {
    return (
        <HeaderBarButton
            icon={DmServeurIcon}
            tooltip="Dmserveur"
            onClick={() => openModal(props => (
                <ModalRoot size={ModalSize.DYNAMIC} transitionState={props.transitionState} onClose={props.onClose}>
                    <ModalHeader separator={false} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--header-primary)", marginRight: 16 }}>
                            {t("Dmserveur Configuration")}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", marginRight: 16 }}>
                            <DmServeurStatusToggle />
                        </div>
                        <ModalCloseButton onClick={props.onClose} />
                    </ModalHeader>
                    <ModalContent>
                        <div style={{ padding: 16 }}>
                            <DmServeurPanel showHeader={false} />
                        </div>
                    </ModalContent>
                </ModalRoot>
            ))}
        />
    );
};

export default definePlugin({
    name: "Dmserveur",
    description: "AI that talks naturally in your community servers. Multiple personalities, learns abbreviations, configurable response triggers and rate limits.",
    authors: [{ name: "YouCord", id: 0n }],
    settings,
    headerBarButton: {
        icon: DmServeurIcon,
        render: DmServeurHeaderButton,
    },
    flux: {
        async MESSAGE_CREATE(data: any) {
            const msg = data.message || data;
            if (msg?.author) handleMessage(msg);
        },
    },
    start() { },
    stop() { },
});
