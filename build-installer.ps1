# build-installer.ps1 — Build YouCord-Installer.exe (.NET 8 C# WinForms + WebView2)
# Usage: .\build-installer.ps1

$ErrorActionPreference = "Stop"
$Root      = $PSScriptRoot
$SrcDir    = Join-Path $Root "installer-src"
$OutDir    = Join-Path $Root "release\installer"
$OutExe    = Join-Path $OutDir "YouCord-Installer.exe"

Write-Host ""
Write-Host "  [YouCord] Building .NET installer..." -ForegroundColor Cyan

# Vérifier dotnet SDK
$dotnetOk = $null
try { $dotnetOk = & dotnet --version 2>$null } catch {}
if (-not $dotnetOk) {
    Write-Host "  [ERREUR] .NET SDK introuvable. Installez-le depuis https://dotnet.microsoft.com/download" -ForegroundColor Red
    exit 1
}
Write-Host "  .NET SDK : $dotnetOk" -ForegroundColor DarkGray

# Dossier de sortie
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# dotnet publish
Write-Host "  [1/1] dotnet publish -c Release..." -ForegroundColor DarkGray
Push-Location $SrcDir
& dotnet publish -c Release
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERREUR] dotnet publish a echoue." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Copier vers le dossier de sortie
$built = "installer-src/bin/Release/net8.0-windows/win-x64/publish/YouCord-Installer.exe"
if (Test-Path $built) {
    Copy-Item $built $OutExe -Force
    $size = [math]::Round((Get-Item $OutExe).Length / 1KB, 0)
    Write-Host ""
    Write-Host "  OK  YouCord-Installer.exe compile ($size KB)" -ForegroundColor Green
    Write-Host "    -> $OutExe" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "  [ERREUR] YouCord-Installer.exe introuvable apres compilation." -ForegroundColor Red
    Write-Host "  Cherche dans : $(Resolve-Path $built -ErrorAction SilentlyContinue)" -ForegroundColor Red
    exit 1
}
