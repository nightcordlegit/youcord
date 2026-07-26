$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$ReleaseDir = Join-Path $Root "release"
$WinUnpacked = Join-Path $ReleaseDir "win-unpacked"
$OutDir = Join-Path $ReleaseDir "win-unpacked"
$ResDir = Join-Path $OutDir "resources"

# €”€” Détecter Discord €”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”
$discordPath = $env:LOCALAPPDATA + "\Discord"
$appDirs = Get-ChildItem -Path $discordPath -Directory -Filter "app-*" | Sort-Object Name -Descending
if (-not $appDirs) {
    Write-Host "[ERREUR] Discord introuvable dans $discordPath" -ForegroundColor Red
    exit 1
}
$DISCORD = $appDirs[0].FullName
Write-Host "Discord : $DISCORD" -ForegroundColor DarkGray

# Lire la version depuis le package.json ou appx.manifest
try {
    $pkg = Get-Content (Join-Path $DISCORD "resources\app\package.json") -Raw | ConvertFrom-Json
    $DISCORD_VER = $pkg.version
} catch {
    $DISCORD_VER = Split-Path $DISCORD -Leaf -replace "^app-", ""
}
Write-Host "Version : $DISCORD_VER" -ForegroundColor DarkGray

# Lire la version YouCord
$youcordVer = (Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json).version
Write-Host "YouCord  : $youcordVer" -ForegroundColor DarkGray

Write-Host "=== ETAPE 1 : Build (electron-builder --dir) ===" -ForegroundColor Cyan
Set-Location $Root
pnpm exec electron-builder --config electron-builder.config.cjs --win dir --x64

Write-Host "=== ETAPE 2 : Copie _app.asar ===" -ForegroundColor Cyan
$appAsar = Join-Path $DISCORD "resources\_app.asar"
if (Test-Path $appAsar) {
    Copy-Item $appAsar (Join-Path $ResDir "_app.asar") -Force
    Write-Host "_app.asar OK"
} else {
    Write-Host "[ATTENTION] _app.asar introuvable" -ForegroundColor Yellow
}

Write-Host "=== ETAPE 3 : standalone_modules ===" -ForegroundColor Cyan
$ModSrc = Join-Path $DISCORD "modules"
$ModDst = Join-Path $ResDir "standalone_modules"
if (Test-Path $ModSrc) {
    New-Item -ItemType Directory -Path $ModDst -Force | Out-Null
    Get-ChildItem -Path $ModSrc -Directory | ForEach-Object {
        $cleanName = $_.Name -replace '-\d+$', ''
        $innerSrc = Join-Path $_.FullName $cleanName
        $dst = Join-Path $ModDst $cleanName
        if (Test-Path $innerSrc) {
            Copy-Item -Recurse -Force -Path $innerSrc -Destination $dst
            Write-Host "  $cleanName OK"
        }
    }
} else {
    Write-Host "[ATTENTION] modules introuvable" -ForegroundColor Yellow
}

Write-Host "=== ETAPE 4 : build_info.json ===" -ForegroundColor Cyan
$buildInfo = @{
    newUpdater        = $false
    releaseChannel    = "stable"
    version           = $DISCORD_VER
    standaloneModules = $true
} | ConvertTo-Json -Compress
Set-Content -Path (Join-Path $ResDir "build_info.json") -Value $buildInfo -Encoding UTF8
Write-Host "build_info.json OK"

Write-Host "=== ETAPE 5 : app/dist/_app.asar ===" -ForegroundColor Cyan
$AppDist = Join-Path $ResDir "app\dist"
New-Item -ItemType Directory -Path $AppDist -Force | Out-Null
if (Test-Path $appAsar) {
    Copy-Item $appAsar (Join-Path $AppDist "_app.asar") -Force
    Write-Host "app/dist/_app.asar OK"
}

Write-Host "=== ETAPE 6 : Creation portable exe ===" -ForegroundColor Cyan
Set-Location $Root
pnpm exec electron-builder --config electron-builder.config.cjs --win portable --x64 --prepackaged $WinUnpacked

Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Fichier : release\YouCord-$youcordVer-portable.exe" -ForegroundColor Green
