# ==============================================================================
#  YouCord â€” Installeur utilisateur (PowerShell autonome)
#  
#  Ce script fait TOUT automatiquement :
#  1. TÃ©lÃ©charge EquilotlCli.exe (outil d'injection graphique)
#  2. TÃ©lÃ©charge les fichiers YouCord compilÃ©s depuis GitHub
#  3. Lance l'interface graphique pour choisir votre Discord cible
#  4. Injecte YouCord dans Discord
#
#  Aucun Node.js, aucun pnpm, aucun code source requis.
#  Usage : Clic droit â†’ "ExÃ©cuter avec PowerShell"
# ==============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
$YouCordRepo   = "youcordfr/youcord"
$EquilotlUrl     = "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli.exe"
$InstallDir      = Join-Path $env:LOCALAPPDATA "YouCord"
$DistDir         = Join-Path $InstallDir "dist"
$InstallerDir    = Join-Path $InstallDir "installer"
$EquilotlExe     = Join-Path $InstallerDir "EquilotlCli.exe"

function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Cyan
    Write-Host "  â•‘          YOUCORD  INSTALLER            â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘  Injection rapide dans Discord Desktop   â•‘" -ForegroundColor DarkCyan
    Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($n, $total, $msg) {
    Write-Host "  [$n/$total] " -NoNewline -ForegroundColor Yellow
    Write-Host $msg
}

function Write-OK($msg) {
    Write-Host "          âœ“ " -NoNewline -ForegroundColor Green
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

# â”€â”€ DÃ©marrage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Banner

# CrÃ©er les dossiers
New-Item -ItemType Directory -Force -Path $InstallDir  | Out-Null
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null
New-Item -ItemType Directory -Force -Path $DistDir      | Out-Null

# â”€â”€ [1/3] TÃ©lÃ©charger / Mettre Ã  jour EquilotlCli.exe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Step 1 3 "VÃ©rification de l'outil d'installation..."

$needDownload = $true
if (Test-Path $EquilotlExe) {
    # VÃ©rifier si une mise Ã  jour est disponible via HEAD
    try {
        $head = Invoke-WebRequest -Uri $EquilotlUrl -Method Head -UseBasicParsing `
            -Headers @{ "User-Agent" = "YouCord-Installer/2.0" }
        $remoteSize = if ($head.Headers.ContainsKey("Content-Length")) { [long]$head.Headers["Content-Length"] } else { 0L }
        $localSize  = (Get-Item $EquilotlExe).Length
        if ($remoteSize -gt 0 -and $remoteSize -eq $localSize) {
            $needDownload = $false
            Write-OK "EquilotlCli.exe dÃ©jÃ  Ã  jour."
        }
    } catch { }
}

if ($needDownload) {
    Write-Host "          TÃ©lÃ©chargement de EquilotlCli.exe..." -ForegroundColor DarkGray
    try {
        Invoke-WebRequest -Uri $EquilotlUrl -OutFile $EquilotlExe -UseBasicParsing `
            -Headers @{ "User-Agent" = "YouCord-Installer/2.0" }
        Write-OK "EquilotlCli.exe tÃ©lÃ©chargÃ© !"
    } catch {
        Write-Fail "Impossible de tÃ©lÃ©charger EquilotlCli.exe.`n           VÃ©rifiez votre connexion internet.`n           DÃ©tail : $_"
    }
}

# â”€â”€ [2/3] TÃ©lÃ©charger les fichiers YouCord â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Step 2 3 "TÃ©lÃ©chargement des fichiers YouCord depuis GitHub..."

try {
    $apiUrl   = "https://api.github.com/repos/$YouCordRepo/releases/latest"
    $release  = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing `
        -Headers @{ "User-Agent" = "YouCord-Installer/2.0"; "Accept" = "application/vnd.github.v3+json" }

    $version  = $release.tag_name
    $distAsset = $release.assets | Where-Object { $_.name -eq "youcord-dist.zip" } | Select-Object -First 1

    if (-not $distAsset) {
        Write-Fail "Fichier 'youcord-dist.zip' introuvable dans la release $version.`n           Contactez le support YouCord."
    }

    Write-Host "          Version : $version" -ForegroundColor DarkGray
    Write-Host "          TÃ©lÃ©chargement en cours..." -ForegroundColor DarkGray

    $zipPath = Join-Path $InstallDir "youcord-dist.zip"
    Invoke-WebRequest -Uri $distAsset.browser_download_url -OutFile $zipPath -UseBasicParsing `
        -Headers @{ "User-Agent" = "YouCord-Installer/2.0" }

    # Extraire proprement (supprimer l'ancien dist d'abord)
    if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $DistDir -Force
    Remove-Item $zipPath -Force

    # Sauvegarder la version installÃ©e
    Set-Content -Path (Join-Path $InstallDir "version.txt") -Value $version

    Write-OK "YouCord $version prÃªt Ã  Ãªtre injectÃ© !"
} catch {
    Write-Fail "Ã‰chec du tÃ©lÃ©chargement YouCord.`n           DÃ©tail : $_"
}

# â”€â”€ [3/3] Injection via EquilotlCli â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Step 3 3 "Lancement de l'interface d'injection..."
Write-Host ""
Write-Host "          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”" -ForegroundColor DarkCyan
Write-Host "          â”‚  Une fenÃªtre va s'ouvrir.                       â”‚" -ForegroundColor DarkCyan
Write-Host "          â”‚  SÃ©lectionnez le Discord oÃ¹ injecter YouCord. â”‚" -ForegroundColor DarkCyan
Write-Host "          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜" -ForegroundColor DarkCyan
Write-Host ""

# Ces variables d'environnement indiquent Ã  EquilotlCli oÃ¹ trouver les fichiers
$env:EQUICORD_USER_DATA_DIR = $InstallDir
$env:EQUICORD_DIRECTORY     = $DistDir
$env:EQUICORD_DEV_INSTALL   = "1"

try {
    & $EquilotlExe "--install"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "EquilotlCli a retournÃ© une erreur (code $LASTEXITCODE)."
    }
} catch {
    Write-Fail "Impossible de lancer l'installeur.`n           DÃ©tail : $_"
}

# â”€â”€ SuccÃ¨s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host ""
Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Green
Write-Host "  â•‘  YouCord installÃ© avec succÃ¨s !                    â•‘" -ForegroundColor Green
Write-Host "  â•‘                                                      â•‘" -ForegroundColor Green
Write-Host "  â•‘  â†’ RedÃ©marrez Discord pour appliquer YouCord.      â•‘" -ForegroundColor Green
Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Green
Write-Host ""
Write-Host "  Pour dÃ©sinstaller : exÃ©cutez youcord-uninstall.bat" -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 4
