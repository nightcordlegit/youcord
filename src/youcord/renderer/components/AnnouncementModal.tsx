/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, Flex, Heading, Link, Paragraph } from "@YouCord/types/components";
import { ModalContent, ModalFooter, ModalHeader, ModalRoot } from "@YouCord/types/utils";
import { React } from "@YouCord/types/webpack/common";

type ModalProps = { transitionState: any; onClose(): void; };

function AlertTriangleIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M12 2L1 21h22L12 2z" fill="#f5a623" stroke="#f5a623" strokeWidth="0" />
            <path d="M12 2L1 21h22L12 2z" fill="none" stroke="#e08c00" strokeWidth="1" />
            <text x="12" y="17.5" textAnchor="middle" fill="#1a1a1a" fontSize="11" fontWeight="bold" fontFamily="sans-serif">!</text>
        </svg>
    );
}

function ShieldOffIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginRight: "6px", verticalAlign: "middle" }}>
            <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z" fill="#ed4245" />
            <path d="M9 9l6 6M15 9l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function CheckCircleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginRight: "6px", verticalAlign: "middle" }}>
            <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z" fill="#57f287" />
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function AnnouncementModal(props: ModalProps) {
    const { onClose } = props;
    const [timeLeft, setTimeLeft] = React.useState(5);
    const canClose = timeLeft === 0;

    React.useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft]);

    return (
        <ModalRoot {...props} size="medium">
            <ModalHeader separator={false} style={{ paddingTop: "20px", paddingBottom: "4px" }}>
                <Flex direction={(Flex as any).Direction.VERTICAL} align={(Flex as any).Align.CENTER} style={{ width: "100%", gap: "8px" }}>
                    <AlertTriangleIcon />
                    <Heading level={2} variant="heading-xl/semibold" style={{ textAlign: "center" }}>
                        Avertissement Important
                    </Heading>
                </Flex>
            </ModalHeader>
            <ModalContent style={{ padding: "16px 24px" }}>
                <div style={{
                    background: "rgba(240, 71, 71, 0.07)",
                    border: "1px solid rgba(240, 71, 71, 0.3)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    marginBottom: "16px"
                }}>
                    <Flex align={(Flex as any).Align.CENTER} style={{ marginBottom: "10px" }}>
                        <ShieldOffIcon />
                        <Heading level={3} variant="heading-md/semibold">Tentative de détournement</Heading>
                    </Flex>
                    <Paragraph style={{ color: "var(--text-normal)", marginBottom: "8px" }}>
                        Récemment, une personne mal intentionnée a tenté de détourner le projet YouCord pour ses propres intérêts.
                    </Paragraph>
                    <Paragraph style={{ color: "var(--text-muted)" }}>
                        Cette personne a essayé d'ajouter des <strong style={{ color: "var(--text-danger)" }}>fonctionnalités payantes</strong> et de se faire passer pour un membre officiel de l'équipe. YouCord est et restera <strong>100% gratuit</strong>.
                    </Paragraph>
                </div>

                <div style={{
                    background: "rgba(87, 242, 135, 0.07)",
                    border: "1px solid rgba(87, 242, 135, 0.3)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    marginBottom: "16px"
                }}>
                    <Flex align={(Flex as any).Align.CENTER} style={{ marginBottom: "10px" }}>
                        <CheckCircleIcon />
                        <Heading level={3} variant="heading-md/semibold">Lien officiel</Heading>
                    </Flex>
                    <Paragraph style={{ color: "var(--text-normal)", marginBottom: "8px" }}>
                        Le <strong>seul</strong> Discord officiel de YouCord est accessible via ce lien :
                    </Paragraph>
                    <Link
                        href="https://discord.gg/mwxsEuEp54"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            VencordNative.native.openExternal("https://discord.gg/mwxsEuEp54");
                        }}
                        style={{ fontSize: "15px", fontWeight: "bold" }}
                    >
                        discord.gg/mwxsEuEp54
                    </Link>
                    <Paragraph style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "13px" }}>
                        Tout autre lien ou serveur prétendant être officiel est une arnaque.
                    </Paragraph>
                </div>

                <div style={{
                    borderTop: "1px solid var(--background-modifier-accent)",
                    paddingTop: "12px"
                }}>
                    <Paragraph style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>
                        <strong>Note :</strong> Ne téléchargez YouCord que depuis nos canaux officiels pour garantir votre sécurité.
                    </Paragraph>
                </div>
            </ModalContent>
            <ModalFooter style={{ justifyContent: "flex-end" }}>
                <Button
                    color={canClose ? (Button as any).Colors.BRAND : (Button as any).Colors.PRIMARY}
                    disabled={!canClose}
                    onClick={onClose}
                    look={(Button as any).Looks.FILLED}
                    style={{ minWidth: "110px" }}
                >
                    {canClose ? "OK" : `OK (${timeLeft}s)`}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
