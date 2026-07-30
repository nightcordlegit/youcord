#!/bin/bash
# YouCord -- Installateur Linux direct (sans Equilotl)
# Injection directe dans Discord Linux.
#
# Usage: ./install.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}YouCord Installer (direct injection)${NC}"
echo ""

# Detecter Discord
CANDIDATES=(
    "/usr/share/discord/resources"
    "/usr/lib/discord/resources"
    "/opt/discord/resources"
    "/opt/Discord/resources"
    "$HOME/.local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources"
    "/snap/discord/current/usr/share/discord/resources"
)

RESOURCES_DIR=""
for dir in "${CANDIDATES[@]}"; do
    if [ -d "$dir" ]; then
        if [ -f "$dir/app.asar" ] || [ -d "$dir/app" ] || [ -f "$dir/_app.asar" ]; then
            RESOURCES_DIR="$dir"
            break
        fi
    fi
done

if [ -z "$RESOURCES_DIR" ]; then
    echo -e "${RED}Discord installation not found.${NC}"
    echo "Make sure Discord is installed in one of the standard locations."
    exit 1
fi

echo -e "Discord found at: ${GREEN}$RESOURCES_DIR${NC}"

# Trouver le patcher.js (dans le repertoire du script ou courant)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PATCHER_CANDIDATES=(
    "$SCRIPT_DIR/dist/desktop/patcher.js"
    "$(pwd)/dist/desktop/patcher.js"
    "/opt/YouCord/dist/desktop/patcher.js"
    "$HOME/.local/share/YouCord/dist/desktop/patcher.js"
)

PATCHER_PATH=""
for path in "${PATCHER_CANDIDATES[@]}"; do
    if [ -f "$path" ]; then
        PATCHER_PATH="$path"
        break
    fi
done

if [ -z "$PATCHER_PATH" ]; then
    echo -e "${RED}patcher.js not found!${NC}"
    echo "Run 'pnpm build' first, or specify the path manually."
    exit 1
fi

echo -e "Using patcher: ${GREEN}$PATCHER_PATH${NC}"

# Injection
APP_DIR="$RESOURCES_DIR/app"
BACKUP="$RESOURCES_DIR/_app.asar"
APP_ASAR="$RESOURCES_DIR/app.asar"

# Tuer Discord
for proc in discord Discord DiscordPTB DiscordCanary; do
    pkill -f "$proc" 2>/dev/null || true
done
sleep 1

# Backup app.asar
if [ -f "$APP_ASAR" ] && [ ! -f "$BACKUP" ]; then
    echo "Backing up app.asar -> _app.asar..."
    mv "$APP_ASAR" "$BACKUP"
fi

if [ ! -f "$BACKUP" ]; then
    echo -e "${RED}No app.asar or _app.asar found!${NC}"
    exit 1
fi

# Supprimer ancien app/ ou app.asar
if [ -f "$APP_ASAR" ]; then
    rm -f "$APP_ASAR"
fi
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
fi

# Creer app/ loader
mkdir -p "$APP_DIR"
cat > "$APP_DIR/package.json" <<EOF
{"name":"youcord","main":"index.js"}
EOF
cat > "$APP_DIR/index.js" <<EOF
// YouCord Injector -- auto-generated
"use strict";
require("$PATCHER_PATH");
EOF

echo -e "${GREEN}YouCord injected successfully!${NC}"
echo -e "Restart Discord to apply changes."
