/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ConfirmModal as ConfirmModalType, MediaModalProps,Modal as ModalType, ModalAPI as ModalAPIType } from "@vencord/discord-types/src/components/Modal";
import { filters, findByCodeLazy, findExportedComponentLazy, mapMangledModuleLazy } from "@webpack";

export const Modal: ModalType = findExportedComponentLazy("Modal") as any;
export const ConfirmModal: ConfirmModalType = findExportedComponentLazy("ConfirmModal") as any;

// Modal key: "Media Viewer Modal"
export const openMediaModal: (props: MediaModalProps) => void = findByCodeLazy("hasMediaOptions", "shouldHideMediaOptions") as any;

const ModalAPI: ModalAPIType = mapMangledModuleLazy(".modalKey?", {
    openModalLazy: filters.byCode(".modalKey?"),
    openModal: filters.byCode(",instant:"),
    closeModal: filters.byCode(".onCloseCallback()"),
    closeAllModals: filters.byCode(".getState();for")
}) as any;

export const { openModalLazy, openModal, closeModal, closeAllModals } = ModalAPI;
