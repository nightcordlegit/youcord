/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { HeadingPrimary, HeadingSecondary } from "@components/Heading";
import { runDiscordRequest } from "@utils/discordRequestQueue";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { RestAPI, SearchableSelect, TextArea, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { settings } from "../index";

const DEFAULT_MESSAGES = [
    "t'es littéralement un PNJ",
    "t'es vraiment un boomer",
    "t'es un sacré clown",
    "frérot est un rageux certifié",
    "t'as vraiment zéro charisme",
    "tu te comportes comme une Karen",
    "frérot est tellement moyen",
    "tu parles vraiment beaucoup pour rien",
    "frérot réfléchit au ralenti",
    "t'es vraiment un gros tryhard",
    "t'es vraiment un bot",
    "t'es une fraude totale",
    "frérot est un PNJ certifié",
    "tu te comportes comme un bébé",
    "frérot est complètement hors sujet",
    "t'es vraiment perdu",
    "tu veux toujours tout contrôler",
    "t'es vraiment un joueur occasionnel",
    "frérot vit encore en 2012",
    "t'es vraiment un perdant"
];

const DELAY_OPTIONS = [
    { label: "1,2 s (minimum de sécurité)", value: "1200" },
    { label: "2 s", value: "2000" },
    { label: "5 s", value: "5000" },
];

interface Props {
    channel: { id: string; };
    rootProps: ModalProps;
    onRunningChange: (running: boolean) => void;
}

function makeNonce(): string {
    const DISCORD_EPOCH = 1420070400000n;
    const nowMs = BigInt(Date.now());
    const tsPart = (nowMs - DISCORD_EPOCH) << 22n;
    const rndPart = BigInt(Math.floor(Math.random() * 0x3FFFFF));
    return String(tsPart | rndPart);
}

export function FloodModal({ channel, rootProps, onRunningChange }: Props) {
    const savedMessages = settings.store.customMessages;
    const storedDelay = Number(settings.store.customDelay ?? settings.store.defaultDelay ?? 1200);
    const [messages, setMessages] = useState<string[]>(
        savedMessages && savedMessages.length > 0 ? savedMessages : DEFAULT_MESSAGES
    );
    const [fileName, setFileName] = useState<string | null>(
        settings.store.customFileName
    );
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [delayMs, setDelayMs] = useState(String(Math.max(1200, Number.isFinite(storedDelay) ? storedDelay : 1200)));
    const [shuffle, setShuffle] = useState(
        settings.store.customShuffle ?? settings.store.defaultShuffle ?? true
    );
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState("");

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const indexRef = useRef(0);
    const sentCountRef = useRef(0);
    const runningRef = useRef(false);

    const delayOptions = useMemo(() => DELAY_OPTIONS, []);

    useEffect(() => { onRunningChange(running); }, [running, onRunningChange]);
    useEffect(() => {
        return () => {
            runningRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    function startFlood() {
        if (runningRef.current || messages.length === 0) return;
        runningRef.current = true;
        indexRef.current = 0;
        sentCountRef.current = 0;
        setRunning(true);
        setStatus("En cours...");
        scheduleNext();
    }

    function stopFlood() {
        runningRef.current = false;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setRunning(false);
        setStatus("Arrêté");
    }

    function scheduleNext(extraDelay = 0) {
        const ms = Number(delayMs);
        const delay = Math.max(1200, (ms > 0 ? ms : 1200) + extraDelay);
        timerRef.current = setTimeout(tick, delay);
    }

    async function tick() {
        if (!runningRef.current || messages.length === 0) { stopFlood(); return; }
        const idx = shuffle
            ? Math.floor(Math.random() * messages.length)
            : indexRef.current % messages.length;
        indexRef.current++;
        try {
            const response = await runDiscordRequest(() => RestAPI.post({
                url: `/channels/${channel.id}/messages`,
                body: { content: messages[idx], nonce: makeNonce(), tts: false }
            }));
            if (response.status === 429) {
                setStatus("Limite Discord atteinte — attente...");
                if (runningRef.current) scheduleNext(1000);
                return;
            }
            setStatus(`Messages envoyés : ${++sentCountRef.current}`);
        } catch { setStatus("Erreur réseau..."); }
        if (runningRef.current) scheduleNext();
    }

    return (
        <ModalRoot {...rootProps}>
            <ModalHeader className="vc-flood-modal-header">
                <HeadingPrimary className="vc-flood-modal-title">Panneau de flood</HeadingPrimary>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent className="vc-flood-modal-content">

                {/* Messages source */}
                <HeadingSecondary className={Margins.bottom8}>Messages à envoyer</HeadingSecondary>
                {isEditing ? (
                    <div className={Margins.bottom16}>
                        <TextArea
                            value={editValue}
                            onChange={(v: string) => setEditValue(v)}
                            placeholder="Écris tes phrases ici, une par ligne..."
                            rows={8}
                            autoFocus
                            style={{ marginBottom: "12px" }}
                        />
                        <div className="vc-flood-file-row">
                            <Button variant="primary" size="small" onClick={() => {
                                const lines = editValue.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                                if (lines.length > 0) {
                                    setMessages(lines);
                                    const name = `Personnalisé (${lines.length} phrases)`;
                                    setFileName(name);
                                    settings.store.customMessages = lines;
                                    settings.store.customFileName = name;
                                }
                                setIsEditing(false);
                            }}>
                                Enregistrer
                            </Button>
                            <Button variant="secondary" size="small" onClick={() => setIsEditing(false)}>
                                Annuler
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="vc-flood-file-info">
                            {fileName ?? `Par défaut (${messages.length} phrases)`}
                        </div>
                        <div className={`vc-flood-file-row ${Margins.bottom16}`}>
                            <Button variant="secondary" size="small" onClick={() => {
                                setEditValue(messages.join("\n"));
                                setIsEditing(true);
                            }}>
                                Modifier les phrases
                            </Button>
                            <Button variant="secondary" size="small" onClick={() => {
                                setMessages(DEFAULT_MESSAGES);
                                setFileName(null);
                                settings.store.customMessages = [];
                                settings.store.customFileName = null;
                            }}>
                                Réinitialiser
                            </Button>
                        </div>
                    </>
                )}

                <Divider className={Margins.bottom16} />

                {/* Delay */}
                <HeadingSecondary className={Margins.bottom8}>Délai entre les messages</HeadingSecondary>
                <div className={Margins.bottom16}>
                    <SearchableSelect
                        options={delayOptions}
                        value={delayOptions.find(o => o.value === delayMs)?.value}
                        placeholder="Choisir un délai"
                        maxVisibleItems={8}
                        closeOnSelect={true}
                        onChange={(v: string) => {
                            setDelayMs(v);
                            settings.store.customDelay = v;
                        }}
                    />
                </div>

                {/* Status */}
                {status !== "" && (
                    <div className="vc-flood-status">
                        {running && <div className="vc-flood-spinner" />}
                        <span className={running ? "vc-flood-status-active" : "vc-flood-status-idle"}>
                            {status}
                        </span>
                    </div>
                )}

            </ModalContent>

            <ModalFooter className="vc-flood-modal-footer">
                <Button
                    variant={running ? "dangerPrimary" : "positive"}
                    size="medium"
                    onClick={running ? stopFlood : startFlood}
                >
                    {running ? "Arrêter le flood" : "Démarrer le flood"}
                </Button>
                <Button variant="secondary" size="medium" onClick={rootProps.onClose}>
                    Fermer
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
