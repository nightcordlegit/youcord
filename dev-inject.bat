@echo off
title YouCord — Dev Rebuild + Inject
cd /d "%~dp0"

set "PS=powershell -NoProfile -Command"

%PS% "Write-Host '╔══════════════════════════════════════╗' -ForegroundColor Cyan"
%PS% "Write-Host '║        YouCord Dev Injector         ║' -ForegroundColor Cyan"
%PS% "Write-Host '╚══════════════════════════════════════╝' -ForegroundColor Cyan"
echo.

%PS% "Write-Host '[' -NoNewline -ForegroundColor Gray; Write-Host '1/4' -NoNewline -ForegroundColor Yellow; Write-Host '] Killing Discord...' -ForegroundColor Gray"
taskkill /F /IM Discord.exe /T >nul 2>&1
taskkill /F /IM DiscordPTB.exe /T >nul 2>&1
taskkill /F /IM DiscordCanary.exe /T >nul 2>&1
taskkill /F /IM Update.exe /T >nul 2>&1

:waitloop
tasklist /FI "IMAGENAME eq Discord.exe" 2>nul | find /i "Discord.exe" >nul
if not errorlevel 1 (
    %PS% "Write-Host '     Waiting for Discord to close...' -ForegroundColor DarkYellow"
    ping 127.0.0.1 -n 2 >nul
    goto :waitloop
)
%PS% "Write-Host '     ' -NoNewline; Write-Host '✓' -NoNewline -ForegroundColor Green; Write-Host ' Discord closed' -ForegroundColor Gray"
echo.

%PS% "Write-Host '[' -NoNewline -ForegroundColor Gray; Write-Host '2/4' -NoNewline -ForegroundColor Yellow; Write-Host '] Building...' -ForegroundColor Gray"
call pnpm build
if %errorlevel% neq 0 (
    echo.
    %PS% "Write-Host '  [ERROR] pnpm build failed. Aborting.' -ForegroundColor Red"
    pause
    exit /b 1
)
%PS% "Write-Host '     ' -NoNewline; Write-Host '✓' -NoNewline -ForegroundColor Green; Write-Host ' Build complete' -ForegroundColor Gray"
echo.

%PS% "Write-Host '[' -NoNewline -ForegroundColor Gray; Write-Host '3/4' -NoNewline -ForegroundColor Yellow; Write-Host '] Injecting into Discord...' -ForegroundColor Gray"
call pnpm inject
if %errorlevel% neq 0 (
    echo.
    %PS% "Write-Host '  [ERROR] pnpm inject failed. Aborting.' -ForegroundColor Red"
    pause
    exit /b 1
)
%PS% "Write-Host '     ' -NoNewline; Write-Host '✓' -NoNewline -ForegroundColor Green; Write-Host ' Injection done' -ForegroundColor Gray"
echo.

%PS% "Write-Host '[' -NoNewline -ForegroundColor Gray; Write-Host '4/4' -NoNewline -ForegroundColor Yellow; Write-Host '] Restarting Discord...' -ForegroundColor Gray"
set "DISCORD_PATH=%LOCALAPPDATA%\Discord"
if exist "%DISCORD_PATH%\Update.exe" (
    start "" "%DISCORD_PATH%\Update.exe" --processStart Discord.exe
    %PS% "Write-Host '     ' -NoNewline; Write-Host '✓' -NoNewline -ForegroundColor Green; Write-Host ' Discord restarted via Update.exe' -ForegroundColor Gray"
) else (
    for /f "delims=" %%i in ('dir /b /ad /o-n "%DISCORD_PATH%\app-*" 2^>nul') do (
        set "LATEST_APP=%%i"
        goto :found
    )
    :found
    if defined LATEST_APP (
        start "" "%DISCORD_PATH%\%LATEST_APP%\Discord.exe"
        %PS% "Write-Host '     ' -NoNewline; Write-Host '✓' -NoNewline -ForegroundColor Green; Write-Host ' Discord restarted directly' -ForegroundColor Gray"
    ) else (
        %PS% "Write-Host '     [WARN] Discord not found, please restart manually.' -ForegroundColor Yellow"
    )
)

echo.
%PS% "Write-Host '╔══════════════════════════════════════╗' -ForegroundColor Green"
%PS% "Write-Host '║  YouCord updated and injected! ✅   ║' -ForegroundColor Green"
%PS% "Write-Host '╚══════════════════════════════════════╝' -ForegroundColor Green"
echo.
timeout /t 3 /nobreak >nul
