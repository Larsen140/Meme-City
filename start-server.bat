@echo off
cd /d "%~dp0server"
title Meme City Minecraft-Server
:loop
"C:\Program Filesclipse Adoptium\jre-25.0.5.8-hotspotin\java.exe" -Xms2G -Xmx4G -jar server.jar nogui
echo.
echo Server wurde beendet - starte in 10 Sekunden neu (Fenster schliessen zum Beenden) ...
timeout /t 10 >nul
goto loop
