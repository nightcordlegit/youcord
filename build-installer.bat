@echo off
title YouCord Installer - Build
cd /d "%~dp0"

echo.
echo  ================================
echo   YouCord Installer - Build
echo  ================================
echo.

:: Verifie que dotnet est disponible
where dotnet >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] .NET SDK introuvable. Installez-le depuis https://dotnet.microsoft.com/download
    pause
    exit /b 1
)
for /f "delims=" %%v in ('dotnet --version') do echo  .NET SDK : %%v

:: Cree le dossier de sortie si besoin
if not exist "release\installer" mkdir "release\installer"

:: Build avec dotnet publish
echo.
echo  [1/1] dotnet publish -c Release...
cd installer-src
call dotnet publish -c Release
if errorlevel 1 (
    echo  [ERREUR] dotnet publish a echoue.
    cd ..
    pause
    exit /b 1
)
cd ..

:: Copie vers release/installer/
copy /Y "installer-src\bin\Release\net8.0-windows\win-x64\publish\YouCord-Installer.exe" "release\installer\YouCord-Installer.exe" >nul

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
