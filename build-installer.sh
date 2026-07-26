#!/usr/bin/env bash
# €”€”€ YouCord Installer — Build €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
# Builds YouCord-Installer for the current platform (Windows .exe or macOS .dmg)

set -euo pipefail

cd "$(dirname "$0")"

echo ""
echo " ================================"
echo "  YouCord Installer - Build"
echo " ================================"
echo ""

# €”€” Vérifie que node est disponible €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
if ! command -v node &>/dev/null; then
    echo " [ERREUR] Node.js introuvable. Installez Node.js depuis https://nodejs.org"
    exit 1
fi

if ! command -v pnpm &>/dev/null; then
    echo " [ERREUR] pnpm introuvable. Installez-le avec: npm install -g pnpm"
    exit 1
fi

# €”€” Détection de la plateforme €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
OS=$(uname -s)
case "$OS" in
    Darwin) PLATFORM="mac"; EXPECTED="release/installer/YouCord-Installer.dmg" ;;
    *)      PLATFORM="win"; EXPECTED="release/installer/YouCord-Installer.exe" ;;
esac

# €”€” Crée le dossier de sortie si besoin €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
mkdir -p "release/installer"

# €”€” Entre dans le dossier installer-src €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
cd installer-src

# €”€” 1. Installe les dépendances si node_modules absent €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
if [[ ! -d "node_modules" ]]; then
    echo " [1/3] Installation des dependances pnpm..."
    if ! pnpm install; then
        echo " [ERREUR] pnpm install a echoue."
        cd ..
        exit 1
    fi
    echo " [1/3] Dependances installees."
else
    echo " [1/3] Dependances deja presentes, on passe."
fi

# €”€” 2. Compile avec electron-webpack €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
echo ""
echo " [2/3] Compilation webpack (electron-webpack)..."

if ! pnpm run compile; then
    echo " [ERREUR] Compilation webpack echouee."
    cd ..
    exit 1
fi

echo " [2/3] Compilation webpack reussie."

# €”€” 3. Packaging electron-builder €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
echo ""
echo " [3/3] Packaging electron-builder --$PLATFORM..."

if ! pnpm exec electron-builder --$PLATFORM -p never; then
    echo " [ERREUR] electron-builder a echoue."
    cd ..
    exit 1
fi

cd ..

# €”€” Vérification €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
if [[ ! -f "$EXPECTED" ]]; then
    echo ""
    echo " [ERREUR] $EXPECTED introuvable apres build."
    exit 1
fi

SIZE=$(stat -c%s "$EXPECTED" 2>/dev/null \
    || stat -f%z "$EXPECTED")

echo ""
echo " [OK] Build reussi !"
echo " Fichier : $EXPECTED  ($SIZE octets)"
echo ""
