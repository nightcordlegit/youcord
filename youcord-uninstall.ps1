# ==============================================================================
#  YouCord -- Desinstalleur utilisateur (PowerShell)
#  Supprime l'injection YouCord de Discord
#
#  Usage : Clic droit -> "Executer avec PowerShell"
# ==============================================================================

$ErrorActionPreference = "Stop"

$InstallDir    = Join-Path $env:LOCALAPPDATA "YouCord-Client"
$DistDir       = Join-Path $InstallDir "dist\desktop"
$InstallerDir  = Join-Path $InstallDir "installer"
$EquilotlExe   = Join-Path $InstallerDir "EquilotlCli.exe"

Clear-Host
Write-Host ""
Write-Host "  +-----------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |      YOUCORD -- Desinstalleur                  |" -ForegroundColor Cyan
Write-Host "  +-----------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $EquilotlExe)) {
    Write-Host "  [INFO] EquilotlCli.exe introuvable." -ForegroundColor Yellow
    Write-Host "         Telechargement de l'outil de desinstallation..." -ForegroundColor Yellow
    Write-Host ""
    New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null
    $EquilotlUrl = "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli.exe"
    Invoke-WebRequest -Uri $EquilotlUrl `
        -Headers @{ "User-Agent" = "YouCord-Installer/2.0" } `
        -OutFile $EquilotlExe -UseBasicParsing
}

Write-Host "  Lancement du desinstalleur graphique..." -ForegroundColor Yellow
Write-Host "  Une fenetre va s'ouvrir pour choisir votre Discord cible." -ForegroundColor Yellow
Write-Host ""

$env:EQUICORD_USER_DATA_DIR = $InstallDir
$env:EQUICORD_DIRECTORY     = $DistDir
$env:EQUICORD_DEV_INSTALL   = "1"

try {
    & $EquilotlExe "--uninstall"
} catch {
    Write-Host "  [ERREUR] La desinstallation a echoue : $_" -ForegroundColor Red
    Write-Host "  Appuyez sur une touche pour quitter..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "  +-----------------------------------------------+" -ForegroundColor Green
Write-Host "  |  YouCord desinstalle avec succes !             |" -ForegroundColor Green
Write-Host "  |  Redemarrez Discord pour appliquer les chang.  |" -ForegroundColor Green
Write-Host "  +-----------------------------------------------+" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 3
