/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { React } from "@webpack/common";

export const OFFICIAL_DISCORD_INVITE = "https://discord.gg/mwxsEuEp54";

function AlertTriangleIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M12 2L1 21h22L12 2z" fill="#f5a623" />
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
        <ModalRoot {...props}>
            <ModalHeader separator={false}>
                <Flex flexDirection="column" alignItems="center" style={{ width: "100%", gap: "8px", paddingTop: "20px" }}>
                    <AlertTriangleIcon />
                    <Heading tag="h2">Important Security Notice</Heading>
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
                    <Flex alignItems="center" style={{ marginBottom: "10px" }}>
                        <ShieldOffIcon />
                        <Heading tag="h3">Hijacking attempt</Heading>
                    </Flex>
                    <Paragraph style={{ marginBottom: "8px" }}>
                        Recently, a malicious individual attempted to hijack the YouCord project for their own interests.
                    </Paragraph>
                    <Paragraph style={{ color: "var(--text-muted)" }}>
                        This person tried to add <strong style={{ color: "var(--text-danger)" }}>paid features</strong> and impersonate an official team member. YouCord is and will remain <strong>100% free</strong>.
                    </Paragraph>
                </div>

                <div style={{
                    background: "rgba(87, 242, 135, 0.07)",
                    border: "1px solid rgba(87, 242, 135, 0.3)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    marginBottom: "16px"
                }}>
                    <Flex alignItems="center" style={{ marginBottom: "10px" }}>
                        <CheckCircleIcon />
                        <Heading tag="h3">Official link</Heading>
                    </Flex>
                    <Paragraph style={{ marginBottom: "8px" }}>
                        The <strong>only</strong> official YouCord Discord server is accessible through this link:
                    </Paragraph>
                    <Link
                        href={OFFICIAL_DISCORD_INVITE}
                        onClick={e => {
                            e.preventDefault();
                            VencordNative.native.openExternal(OFFICIAL_DISCORD_INVITE);
                        }}
                        style={{ fontSize: "15px", fontWeight: "bold" }}
                    >
                        discord.gg/mwxsEuEp54
                    </Link>
                    <Paragraph style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                        Any other link or server claiming to be official is a scam.
                    </Paragraph>
                </div>

                <div style={{
                    borderTop: "1px solid var(--background-modifier-accent)",
                    paddingTop: "12px"
                }}>
                    <Paragraph style={{ fontStyle: "italic", fontSize: "13px", color: "var(--text-muted)" }}>
                        <strong>Note:</strong> Only download YouCord from our official channels to ensure your security.
                    </Paragraph>
                </div>
            </ModalContent>
            <ModalFooter justify="flex-end">
                <Button
                    variant={canClose ? "primary" : "secondary"}
                    disabled={!canClose}
                    onClick={onClose}
                    style={{ minWidth: "110px" }}
                >
                    {canClose ? "OK" : `OK (${timeLeft}s)`}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
