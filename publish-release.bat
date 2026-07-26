@echo off
:: ---- YouCord -- Publier une nouvelle release sur GitHub -------------------
:: Usage : publish-release.bat 1.22.0 "Description des changements"
:: Necessite : pnpm, node, curl
::
:: Auth : token GitHub dans %USERPROFILE%\.github_token  (1 ligne)
::        Creer le fichier : echo votre_token > %USERPROFILE%\.github_token
::        Token besoin de scope "repo" (ou "public_repo")

setlocal EnableDelayedExpansion

set "VERSION=%~1"
set "NOTES=%~2"

if "%VERSION%"=="" (
    echo [ERREUR] Usage: publish-release.bat VERSION "Notes de version"
    echo Exemple : publish-release.bat 1.21.33 "Correction bug audio"
    pause
    exit /b 1
)

if "%NOTES%"=="" set NOTES=YouCord v%VERSION%

:: ---- Config GitHub --------------------------------------------------------
set GH_REPO=nightcordlegit/youcord
set GH_API=https://api.github.com
set GH_UPLOAD=https://uploads.github.com

:: ---- Lecture du token -----------------------------------------------------
set TOKEN_FILE=%USERPROFILE%\.github_token
if not exist "%TOKEN_FILE%" (
    echo  [ERREUR] Fichier de token introuvable : %TOKEN_FILE%
    echo  Creez-le avec : echo votre_token_github ^> "%%USERPROFILE%%\.github_token"
    echo  Token sur : https://github.com/settings/tokens
    pause
    exit /b 1
)

set /p GH_TOKEN=<"%TOKEN_FILE%"
set "GH_TOKEN=%GH_TOKEN: =%"

if "%GH_TOKEN%"=="" (
    echo  [ERREUR] Le fichier %TOKEN_FILE% est vide.
    pause
    exit /b 1
)

:: ---- Preparation ----------------------------------------------------------
set DIST_DIR=dist\desktop
set OUT_DIR=release\installer
set DIST_ZIP=%OUT_DIR%\youcord-dist.zip
set INSTALLER_EXE=%OUT_DIR%\YouCord-Installer.exe
set VERSION_JSON=%OUT_DIR%\version.json
set DESKTOP_ASAR=dist\desktop.asar

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo.
echo  +--------------------------------------------------+
echo  ^|  YOUCORD -- Publication GitHub v%VERSION%         ^|
echo  +--------------------------------------------------+
echo.

:: ---- 1. Update version in package.json -----------------------------------
echo  [1/7] Mise a jour de la version vers %VERSION%...
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '%VERSION%'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n', 'utf8');"
echo  OK

:: ---- 2. Git commit + push -------------------------------------------------
echo.
echo  [2/7] Commit et push du code source...
git add .
git diff --quiet --cached
if errorlevel 1 (
    git commit -m "build: release v%VERSION%"
) else (
    echo  Aucun changement a committer.
)
git push
if errorlevel 1 (
    echo  [ERREUR] Impossible de push sur GitHub.
    pause
    exit /b 1
)
echo  OK

:: ---- 3. Build -------------------------------------------------------------
echo.
echo  [3/7] Build en cours...
call pnpm build
if errorlevel 1 (
    echo  [ERREUR] pnpm build a echoue.
    pause
    exit /b 1
)
echo  OK

:: ---- 4. Copie assets ------------------------------------------------------
echo.
echo  [4/7] Copie des assets...
if exist "scripts\build\collect-assets.mjs" (
    node scripts\build\collect-assets.mjs
)
echo  OK

:: ---- 5. Build installer + Zip dist ----------------------------------------
echo.
echo  [5/7] Compilation de YouCord-Installer.exe...
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -File "build-installer.ps1"
if errorlevel 1 (
    echo  [ERREUR] Compilation de l'installeur echouee.
    pause
    exit /b 1
)
if not exist "%INSTALLER_EXE%" (
    echo  [ERREUR] YouCord-Installer.exe introuvable apres compilation.
    pause
    exit /b 1
)
for %%F in ("%INSTALLER_EXE%") do echo  YouCord-Installer.exe : %%~zF octets

echo.
echo  Creation de youcord-dist.zip...
if not exist "%DIST_DIR%\patcher.js" (
    echo  [ERREUR] dist\desktop\patcher.js introuvable.
    pause
    exit /b 1
)
if exist "%DIST_ZIP%" del /F /Q "%DIST_ZIP%"
del /s /q "%DIST_DIR%\*.map" >nul 2>&1
del /s /q "%DIST_DIR%\*.LEGAL.txt" >nul 2>&1
powershell -NoProfile -Command "Add-Type -Assembly System.IO.Compression.FileSystem; $src = (Resolve-Path '%DIST_DIR%').Path; $dst = (Join-Path (Resolve-Path (Join-Path (Get-Location) 'release\installer')).Path 'youcord-dist.zip'); [System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [System.IO.Compression.CompressionLevel]::Optimal, $false)"
if not exist "%DIST_ZIP%" (
    echo  [ERREUR] Impossible de creer youcord-dist.zip
    pause
    exit /b 1
)
for %%F in ("%DIST_ZIP%") do echo  youcord-dist.zip : %%~zF octets

:: ---- 6. version.json ------------------------------------------------------
echo.
echo  [6/7] version.json...
for /f "usebackq" %%d in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd'"`) do set ISO_DATE=%%d
(
    echo {
    echo   "version": "%VERSION%",
    echo   "releaseDate": "%ISO_DATE%",
    echo   "installerUrl": "https://github.com/%GH_REPO%/releases/download/v%VERSION%/YouCord-Installer.exe",
    echo   "distUrl": "https://github.com/%GH_REPO%/releases/download/v%VERSION%/youcord-dist.zip",
    echo   "downloadUrl": "https://github.com/%GH_REPO%/releases/download/v%VERSION%/desktop.asar",
    echo   "changelog": "%NOTES%"
    echo }
) > "%VERSION_JSON%"
echo  OK

:: ---- 7. Publication GitHub ------------------------------------------------
echo.
echo  [7/7] Creation de la release GitHub v%VERSION%...

:: 7a. Create release
set "JSON_TMP=%OUT_DIR%\release_payload.json"
(
    echo {
    echo   "tag_name": "v%VERSION%",
    echo   "name": "YouCord v%VERSION%",
    echo   "body": "%NOTES%",
    echo   "draft": false,
    echo   "prerelease": false
    echo }
) > "%JSON_TMP%"
curl -s -X POST "%GH_API%/repos/%GH_REPO%/releases" ^
    -H "Authorization: token %GH_TOKEN%" ^
    -H "Content-Type: application/json" ^
    -d "@%JSON_TMP%" ^
    -o "%OUT_DIR%\release_response.json"
del /F /Q "%JSON_TMP%" >nul 2>&1
if errorlevel 1 (
    type "%OUT_DIR%\release_response.json"
    echo  [ERREUR] Echec de la creation de la release GitHub.
    pause
    exit /b 1
)

:: 7b. Extract upload URL
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-Content '%OUT_DIR%\release_response.json' | ConvertFrom-Json).id"`) do set RELEASE_ID=%%i
if "%RELEASE_ID%"=="" (
    echo  [ERREUR] Impossible de recuperer l'ID de la release.
    type "%OUT_DIR%\release_response.json"
    pause
    exit /b 1
)
echo  Release creee (ID: %RELEASE_ID%)

:: 7c. Upload assets
echo  Upload de YouCord-Installer.exe...
curl -s -X POST "%GH_UPLOAD%/repos/%GH_REPO%/releases/%RELEASE_ID%/assets?name=YouCord-Installer.exe" ^
    -H "Authorization: token %GH_TOKEN%" ^
    -H "Content-Type: application/x-msdos-program" ^
    --data-binary "@%INSTALLER_EXE%" >nul
if errorlevel 1 ( echo  [ERREUR] Upload YouCord-Installer.exe & pause & exit /b 1 )

echo  Upload de youcord-dist.zip...
curl -s -X POST "%GH_UPLOAD%/repos/%GH_REPO%/releases/%RELEASE_ID%/assets?name=youcord-dist.zip" ^
    -H "Authorization: token %GH_TOKEN%" ^
    -H "Content-Type: application/zip" ^
    --data-binary "@%DIST_ZIP%" >nul
if errorlevel 1 ( echo  [ERREUR] Upload youcord-dist.zip & pause & exit /b 1 )

echo  Upload de desktop.asar...
curl -s -X POST "%GH_UPLOAD%/repos/%GH_REPO%/releases/%RELEASE_ID%/assets?name=desktop.asar" ^
    -H "Authorization: token %GH_TOKEN%" ^
    -H "Content-Type: application/octet-stream" ^
    --data-binary "@%DESKTOP_ASAR%" >nul
if errorlevel 1 ( echo  [ERREUR] Upload desktop.asar & pause & exit /b 1 )

echo  Upload de version.json...
curl -s -X POST "%GH_UPLOAD%/repos/%GH_REPO%/releases/%RELEASE_ID%/assets?name=version.json" ^
    -H "Authorization: token %GH_TOKEN%" ^
    -H "Content-Type: application/json" ^
    --data-binary "@%VERSION_JSON%" >nul
if errorlevel 1 ( echo  [ERREUR] Upload version.json & pause & exit /b 1 )

del /F /Q "%OUT_DIR%\release_response.json" >nul 2>&1

:: ---- Done ------------------------------------------------------------------
echo.
echo  +-------------------------------------------------------------+
echo  ^|  YouCord v%VERSION% publie sur GitHub !                   ^|
echo  ^|                                                             ^|
echo  ^|  https://github.com/%GH_REPO%/releases/tag/v%VERSION%      ^|
echo  +-------------------------------------------------------------+
echo.
pause
