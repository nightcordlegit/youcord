# ==============================================================================
#  YouCord -- Desinstalleur utilisateur (PowerShell)
#  Supprime l'injection YouCord de Discord sans binaire externe.
#
#  Usage : Clic droit -> "Executer avec PowerShell"
# ==============================================================================

$ErrorActionPreference = "Continue"

Clear-Host
Write-Host ""
Write-Host "  +-----------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |      YOUCORD -- Desinstalleur                  |" -ForegroundColor Cyan
Write-Host "  +-----------------------------------------------+"
Write-Host ""

# ---- Localiser Discord ------------------------------------------------------
$localAppData = $env:LOCALAPPDATA
$channels = @(
    @{ Name = "Discord"; Dir = "Discord" },
    @{ Name = "Discord PTB"; Dir = "DiscordPTB" },
    @{ Name = "Discord Canary"; Dir = "DiscordCanary" },
    @{ Name = "Discord Dev"; Dir = "DiscordDevelopment" }
)

$found = $false
foreach ($ch in $channels) {
    $base = Join-Path $localAppData $ch.Dir
    if (-not (Test-Path $base)) { continue }

    $versions = Get-ChildItem $base -Filter "app-*" | Sort-Object Name -Descending
    foreach ($ver in $versions) {
        $resPath = Join-Path $ver.FullName "resources"
        $appDir = Join-Path $resPath "app"
        $backup = Join-Path $resPath "_app.asar"
        $appAsar = Join-Path $resPath "app.asar"

        if (-not (Test-Path $appDir)) { continue }

        # Verifier que c'est bien YouCord
        $pkgFile = Join-Path $appDir "package.json"
        $isYouCord = $false
        if (Test-Path $pkgFile) {
            $pkgContent = Get-Content $pkgFile -Raw
            if ($pkgContent -match '"youcord"') { $isYouCord = $true }
        }

        if (-not $isYouCord) { continue }
        $found = $true

        Write-Host "  [$ch.Name] Desinstallation en cours..." -ForegroundColor Yellow

        # Tuer Discord
        try {
            taskkill /F /IM "$($ch.Name).exe" /T 2>$null
            taskkill /F /IM "Update.exe" /T 2>$null
            Start-Sleep -Milliseconds 500
        } catch { }

        # Supprimer le dossier app/
        Write-Host "    Suppression du dossier app/..." -ForegroundColor Gray
        try { Remove-Item $appDir -Recurse -Force } catch { }

        # Restaurer app.asar depuis _app.asar
        if (Test-Path $backup) {
            Write-Host "    Restauration de l'original app.asar..." -ForegroundColor Gray
            if (Test-Path $appAsar) { try { Remove-Item $appAsar -Force } catch { } }
            try { Move-Item $backup $appAsar -Force } catch { }
        } else {
            Write-Host "    [ATTENTION] Backup _app.asar introuvable." -ForegroundColor Yellow
        }

        Write-Host "  [$ch.Name] Desinjection reussie !" -ForegroundColor Green

        # Relancer Discord
        try {
            $updateExe = Join-Path $base "Update.exe"
            if (Test-Path $updateExe) {
                Start-Process -FilePath $updateExe -ArgumentList "--processStart $($ch.Name).exe"
                Write-Host "    Discord redemarre." -ForegroundColor Gray
            }
        } catch { }
    }
}

if (-not $found) {
    Write-Host "  Aucune installation YouCord trouvee." -ForegroundColor Yellow
    Write-Host "  Assurez-vous que YouCord a ete injecte via pnpm inject." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Appuyez sur une touche pour fermer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
