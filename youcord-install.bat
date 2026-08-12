@echo off
:: Wrapper .bat pour lancer youcord-install.ps1 facilement (double-clic)
title YouCord — Installation
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0youcord-install.ps1"
if %errorlevel% neq 0 pause
