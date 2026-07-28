/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export const enum IpcEvents {
    INIT_FILE_WATCHERS = "VencordInitFileWatchers",
    QUICK_CSS_UPDATE = "VencordQuickCssUpdate",
    OPEN_QUICKCSS = "VencordOpenQuickCss",
    GET_QUICK_CSS = "VencordGetQuickCss",
    SET_QUICK_CSS = "VencordSetQuickCss",
    UPLOAD_THEME = "VencordUploadTheme",
    DELETE_THEME = "VencordDeleteTheme",
    GET_THEMES_DIR = "VencordGetThemesDir",
    GET_THEMES_LIST = "VencordGetThemesList",
    GET_THEME_DATA = "VencordGetThemeData",
    GET_THEME_SYSTEM_VALUES = "VencordGetThemeSystemValues",
    GET_SETTINGS_DIR = "VencordGetSettingsDir",
    GET_SETTINGS = "VencordGetSettings",
    SET_SETTINGS = "VencordSetSettings",
    THEME_UPDATE = "VencordThemeUpdate",
    OPEN_EXTERNAL = "VencordOpenExternal",
    GET_UPDATES = "VencordGetUpdates",
    GET_LOCAL_BUILD = "VencordGetLocalBuild",
    GET_REPO = "VencordGetRepo",
    UPDATE = "VencordUpdate",
    BUILD = "VencordBuild",
    OPEN_MONACO_EDITOR = "VencordOpenMonacoEditor",
    GET_MONACO_THEME = "VencordGetMonacoTheme",
    GET_INSTALLER_PREFS = "YouCordGetInstallerPrefs",

    GET_PLUGIN_IPC_METHOD_MAP = "VencordGetPluginIpcMethodMap",

    CSP_IS_DOMAIN_ALLOWED = "VencordCspIsDomainAllowed",
    CSP_REMOVE_OVERRIDE = "VencordCspRemoveOverride",
    CSP_REQUEST_ADD_OVERRIDE = "VencordCspRequestAddOverride",

    OPEN_THEMES_FOLDER = "VencordOpenThemesFolder",
    OPEN_SETTINGS_FOLDER = "VencordOpenSettingsFolder",
    GET_RENDERER_CSS = "VencordGetRendererCss",
    RENDERER_CSS_UPDATE = "VencordRendererCssUpdate",
    PRELOAD_GET_RENDERER_JS = "VencordPreloadGetRendererJs",

    SET_TRAY_UPDATE_STATE = "VencordSetTrayUpdateState",
    TRAY_REPAIR = "VencordTrayRepair",
    TRAY_CHECK_UPDATES = "VencordTrayCheckUpdates",
    TRAY_ABOUT = "VencordTrayAbout",

    GET_DESKTOP_SOURCES = "VencordGetDesktopSources",

    SET_WINDOW_BACKGROUND_MATERIAL = "YouCordSetWindowBackgroundMaterial",

    // SoundCord Player — thumbnail toolbar Windows
    SET_THUMBAR_BUTTONS = "SoundCordSetThumbarButtons",
    THUMBAR_BUTTON_CLICK = "SoundCordThumbarButtonClick",

    // YouCord Updater — télécharge un exe depuis une URL et le lance
    YOUCORD_DOWNLOAD_AND_RUN = "YouCordDownloadAndRun",

    // Relaunch de l'app Electron
    RELAUNCH_APP = "YouCordRelaunchApp",

    // Vesktop/Vencord preload events
    GET_VENCORD_PRELOAD_SCRIPT = "VencordGetPreloadScript",
    DEPRECATED_GET_VENCORD_PRELOAD_SCRIPT_PATH = "VencordGetPreloadScriptPath",
    GET_VENCORD_RENDERER_SCRIPT = "VencordGetRendererScript",
    GET_VESKTOP_RENDERER_SCRIPT = "VesktopGetRendererScript",

    // VesktopNative events
    SPELLCHECK_RESULT = "VesktopSpellcheckResult",
    ARRPC_ACTIVITY = "VesktopArrpcActivity",
    DEVTOOLS_OPENED = "VesktopDevtoolsOpened",
    DEVTOOLS_CLOSED = "VesktopDevtoolsClosed",
    GET_VERSION = "VesktopGetVersion",
    GET_GIT_HASH = "VesktopGetGitHash",
    SET_BADGE_COUNT = "VesktopSetBadgeCount",
    SUPPORTS_WINDOWS_TRANSPARENCY = "VesktopSupportsWindowsTransparency",
    GET_ENABLE_HARDWARE_ACCELERATION = "VesktopGetEnableHardwareAcceleration",
    UPDATER_IS_OUTDATED = "VesktopUpdaterIsOutdated",
    UPDATER_OPEN = "VesktopUpdaterOpen",
    GET_PLATFORM_SPOOF_INFO = "VesktopGetPlatformSpoofInfo",
    GET_VESKTOP_RENDERER_CSS = "VesktopGetRendererCss",
    VESKTOP_RENDERER_CSS_UPDATE = "VesktopRendererCssUpdate",
    AUTOSTART_ENABLED = "VesktopAutostartEnabled",
    ENABLE_AUTOSTART = "VesktopEnableAutostart",
    DISABLE_AUTOSTART = "VesktopDisableAutostart",
    IS_USING_CUSTOM_VENCORD_DIR = "VesktopIsUsingCustomVencordDir",
    SHOW_CUSTOM_VENCORD_DIR = "VesktopShowCustomVencordDir",
    SELECT_VENCORD_DIR = "VesktopSelectVencordDir",
    CHOOSE_USER_ASSET = "VesktopChooseUserAsset",
    SPELLCHECK_GET_AVAILABLE_LANGUAGES = "VesktopSpellcheckGetAvailableLanguages",
    SPELLCHECK_REPLACE_MISSPELLING = "VesktopSpellcheckReplaceMisspelling",
    SPELLCHECK_ADD_TO_DICTIONARY = "VesktopSpellcheckAddToDictionary",
    ARRPC_OPEN_SETTINGS = "VesktopArrpcOpenSettings",
    FOCUS = "VesktopFocus",
    CLOSE = "VesktopClose",
    MINIMIZE = "VesktopMinimize",
    MAXIMIZE = "VesktopMaximize",
    FLASH_FRAME = "VesktopFlashFrame",
    CAPTURER_GET_LARGE_THUMBNAIL = "VesktopCapturerGetLargeThumbnail",
    VIRT_MIC_LIST = "VesktopVirtMicList",
    VIRT_MIC_START = "VesktopVirtMicStart",
    VIRT_MIC_START_SYSTEM = "VesktopVirtMicStartSystem",
    VIRT_MIC_STOP = "VesktopVirtMicStop",
    CLIPBOARD_COPY_IMAGE = "VesktopClipboardCopyImage",
    VOICE_STATE_CHANGED = "VesktopVoiceStateChanged",
    VOICE_CALL_STATE_CHANGED = "VesktopVoiceCallStateChanged",
    TOGGLE_SELF_MUTE = "VesktopToggleSelfMute",
    TOGGLE_SELF_DEAF = "VesktopToggleSelfDeaf",
    DEBUG_LAUNCH_GPU = "VesktopDebugLaunchGpu",
    DEBUG_LAUNCH_WEBRTC_INTERNALS = "VesktopDebugLaunchWebrtcInternals",
    IPC_COMMAND = "VesktopIpcCommand",
}

export const enum UpdaterIpcEvents {
    GET_DATA = "VCD_UPDATER_GET_DATA",
    INSTALL = "VCD_UPDATER_INSTALL",
    DOWNLOAD_PROGRESS = "VCD_UPDATER_DOWNLOAD_PROGRESS",
    ERROR = "VCD_UPDATER_ERROR",
    SNOOZE_UPDATE = "VCD_UPDATER_SNOOZE_UPDATE",
    IGNORE_UPDATE = "VCD_UPDATER_IGNORE_UPDATE",
}

export const enum IpcCommands {
    RPC_ACTIVITY = "rpc:activity",
    RPC_INVITE = "rpc:invite",
    RPC_DEEP_LINK = "rpc:link",

    NAVIGATE_SETTINGS = "navigate:settings",

    GET_LANGUAGES = "navigator.languages",

    SCREEN_SHARE_PICKER = "screenshare:picker",
}
