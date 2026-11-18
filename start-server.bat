@echo off
cd /d "%~dp0server"
"C:\Program Files\Eclipse Adoptium\jre-25.0.5.8-hotspot\bin\java.exe" -Xms2G -Xmx4G -jar server.jar nogui
pause
