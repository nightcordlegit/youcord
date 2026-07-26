@echo off
title YouCord Installer - Build
cd /d "%~dp0"

echo.
echo  ================================
echo   YouCord Installer - Build
echo  ================================
echo.

:: Verifie que node est disponible
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Node.js introuvable. Installez Node.js depuis https://nodejs.org
    pause
    exit /b 1
)

:: Cree le dossier de sortie si besoin
if not exist "release\installer" mkdir "release\installer"

:: Entre dans le dossier installer-src
cd installer-src

:: Verifie que pnpm est disponible
where pnpm >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] pnpm introuvable. Installez-le avec: npm install -g pnpm
    cd ..
    pause
    exit /b 1
)

:: Installe les dependances si node_modules absent
if not exist "node_modules" (
    echo  [1/3] Installation des dependances pnpm...
    call pnpm install
    if errorlevel 1 (
        echo  [ERREUR] pnpm install a echoue.
        cd ..
        pause
        exit /b 1
    )
    echo  [1/3] Dependances installees.
) else (
    echo  [1/3] Dependances deja presentes, on passe.
)

:: Compile avec electron-webpack
echo.
echo  [2/3] Compilation webpack (electron-webpack)...
call pnpm run compile
if errorlevel 1 (
    echo  [ERREUR] Compilation webpack echouee.
    cd ..
    pause
    exit /b 1
)
echo  [2/3] Compilation webpack reussie.

:: Build electron-builder -> YouCord-Installer.exe dans ../release/installer/
echo.
echo  [3/3] Packaging electron-builder...
call pnpm exec electron-builder --win -p never
if errorlevel 1 (
    echo  [ERREUR] electron-builder a echoue.
    cd ..
    pause
    exit /b 1
)

cd ..

:: Verification
if not exist "release\installer\YouCord-Installer.exe" (
    echo.
    echo  [ERREUR] YouCord-Installer.exe introuvable apres build.
    pause
    exit /b 1
)

for %%F in ("release\installer\YouCord-Installer.exe") do (
    echo.
    echo  [OK] Build reussi ^!
    echo  Fichier : release\installer\YouCord-Installer.exe  (%%~zF octets^)
    echo.
)

:: Ouvre le dossier de sortie
explorer release\installer

pause
