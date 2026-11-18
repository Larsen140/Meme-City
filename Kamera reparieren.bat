@echo off
rem Repariert die Kamera, falls das Bild stehen bleibt (haengt den Spieler neu an die Kamera).
cd /d "C:\Users\larse\Documents\Meme City"
node tools\rcon.mjs "gamemode creative Larscraft17" >nul
timeout /t 1 >nul
node tools\rcon.mjs "gamemode spectator Larscraft17" >nul
node tools\rcon.mjs "spectate @e[tag=mc_cam,limit=1] Larscraft17" >nul
echo Kamera repariert.
timeout /t 2 >nul
