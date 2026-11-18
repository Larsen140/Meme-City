@echo off
rem Startet Meme City: Minecraft-Server und Spielprogramm in eigenen Fenstern.
rem Bereits laufende Teile werden nicht doppelt gestartet.
cd /d "%~dp0"
if not exist start-server.bat cd /d "C:\Users\larse\Documents\Meme City"
tasklist /v /fi "imagename eq cmd.exe" | find /i "Meme City Minecraft-Server" >nul || start "Meme City Minecraft-Server" /min cmd /c start-server.bat
timeout /t 15 >nul
tasklist /v /fi "imagename eq cmd.exe" | find /i "Meme City Spielprogramm" >nul || start "Meme City Spielprogramm" /min cmd /c start-game.bat
echo Meme City laeuft. Dieses Fenster schliesst sich gleich.
timeout /t 5 >nul
