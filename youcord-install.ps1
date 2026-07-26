# ==============================================================================
#  YouCord -- Installeur utilisateur (PowerShell autonome)
#  
#  Ce script fait TOUT automatiquement :
#  1. Telecharge EquilotlCli.exe (outil d'injection graphique)
#  2. Telecharge les fichiers YouCord compiles depuis GitHub
#  3. Lance l'interface graphique pour choisir votre Discord cible
#  4. Injecte YouCord dans Discord
#
#  Aucun Node.js, aucun pnpm, aucun code source requis.
#  Usage : Clic droit -> "Executer avec PowerShell"
# ==============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ---- Configuration ----------------------------------------------------------
$YouCordRepo   = "youcordfr/youcord"
$EquilotlUrl     = "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli.exe"
$InstallDir      = Join-Path $env:LOCALAPPDATA "YouCord"
$DistDir         = Join-Path $InstallDir "dist"
$InstallerDir    = Join-Path $InstallDir "installer"
$EquilotlExe     = Join-Path $InstallerDir "EquilotlCli.exe"

function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  +------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |          YOUCORD  INSTALLER                     |" -ForegroundColor Cyan
    Write-Host "  |  Injection rapide dans Discord Desktop          |" -ForegroundColor DarkCyan
    Write-Host "  +------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($n, $total, $msg) {
    Write-Host "  [$n/$total] " -NoNewline -ForegroundColor Yellow
    Write-Host $msg
}

function Write-OK($msg) {
    Write-Host "          [OK] " -NoNewline -ForegroundColor Green
    Write-Host $msg
}

function Write-Fail($msg) {
    Write-Host ""
    Write-Host "  [ERREUR] $msg" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Appuyez sur une touche pour quitter..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# ---- Demarrage --------------------------------------------------------------
Write-Banner

# Creer les dossiers
New-Item -ItemType Directory -Force -Path $InstallDir  | Out-Null
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null
New-Item -ItemType Directory -Force -Path $DistDir      | Out-Null

# ---- [1/3] Telecharger / Mettre a jour EquilotlCli.exe -----------------------
Write-Step 1 3 "Verification de l'outil d'installation..."

$needDownload = $true
if (Test-Path $EquilotlExe) {
    # Verifier si une mise a jour est disponible via HEAD
    try {
        $head = Invoke-WebRequest -Uri $EquilotlUrl -Method Head -UseBasicParsing `
            -Headers @{ "User-Agent" = "YouCord-Installer/2.0" }
        $remoteSize = if ($head.Headers.ContainsKey("Content-Length")) { [long]$head.Headers["Content-Length"] } else { 0L }
        $localSize  = (Get-Item $EquilotlExe).Length
        if ($remoteSize -gt 0 -and $remoteSize -eq $localSize) {
            $needDownload = $false
            Write-OK "EquilotlCli.exe deja a jour."
        }
    } catch { }
}

if ($needDownload) {
    Write-Host "          Telechargement de EquilotlCli.exe..." -ForegroundColor DarkGray
    try {
        Invoke-WebRequest -Uri $EquilotlUrl -OutFile $EquilotlExe -UseBasicParsing `
            -Headers @{ "User-Agent" = "YouCord-Installer/2.0" }
        Write-OK "EquilotlCli.exe telecharge !"
    } catch {
        Write-Fail "Impossible de telecharger EquilotlCli.exe.`n           Verifiez votre connexion internet.`n           Detail : $_"
    }
}

# ---- [2/3] Copier les fichiers YouCord (build local) ------------------------
Write-Step 2 3 "Copie des fichiers YouCord depuis le build local..."

$LocalDist = Join-Path $PSScriptRoot "dist\desktop"
if (-not (Test-Path $LocalDist)) {
    Write-Fail "Build local introuvable dans '$LocalDist'.`n           Lancez 'pnpm buildDesktop' d'abord."
}
if (-not (Test-Path "$LocalDist\patcher.js")) {
    Write-Fail "Fichier patcher.js introuvable dans '$LocalDist'.`n           Verifiez que le build est complet."
}

try {
    # Supprimer l'ancien dist et copier le nouveau
    if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    Copy-Item "$LocalDist\*" $DistDir -Recurse -Force

    # Lire la version depuis package.json
    $pkgPath = Join-Path $PSScriptRoot "package.json"
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    $version = $pkg.version
    Set-Content -Path (Join-Path $InstallDir "version.txt") -Value $version

    Write-OK "YouCord v$version (build local) pret a etre injecte !"
} catch {
    Write-Fail "Echec de la copie des fichiers YouCord.`n           Detail : $_"
}

# ---- [3/3] Injection via EquilotlCli ----------------------------------------
Write-Step 3 3 "Lancement de l'interface d'injection..."
Write-Host ""
Write-Host "          +-----------------------------------------------+" -ForegroundColor DarkCyan
Write-Host "          |  Une fenetre va s'ouvrir.                      |" -ForegroundColor DarkCyan
Write-Host "          |  Selectionnez le Discord ou injecter YouCord.  |" -ForegroundColor DarkCyan
Write-Host "          +-----------------------------------------------+" -ForegroundColor DarkCyan
Write-Host ""

# Ces variables d'environnement indiquent a EquilotlCli ou trouver les fichiers
$env:EQUICORD_USER_DATA_DIR = $InstallDir
$env:EQUICORD_DIRECTORY     = $DistDir
$env:EQUICORD_DEV_INSTALL   = "1"

try {
    & $EquilotlExe "--install"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "EquilotlCli a retourne une erreur (code $LASTEXITCODE)."
    }
} catch {
    Write-Fail "Impossible de lancer l'installeur.`n           Detail : $_"
}

# ---- Succes -----------------------------------------------------------------
Write-Host ""
Write-Host "  +------------------------------------------------+" -ForegroundColor Green
Write-Host "  |  YouCord installe avec succes !                 |" -ForegroundColor Green
Write-Host "  |                                                 |" -ForegroundColor Green
Write-Host "  |  >> Redemarrez Discord pour appliquer YouCord.  |" -ForegroundColor Green
Write-Host "  +------------------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  Pour desinstaller : executez youcord-uninstall.bat" -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 4
