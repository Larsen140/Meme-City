@echo off
cd /d "%~dp0"
title Meme City Spielprogramm
:loop
node src/index.js
echo.
echo Spielprogramm wurde beendet - starte in 5 Sekunden neu ...
timeout /t 5 >nul
goto loop
