# Meme City

Interaktiver TikTok-LIVE in Minecraft: Zuschauer bekommen Häuser, bauen sie mit Likes und Geschenken aus.

## Starten (jedes Mal)
1. `start-server.bat` doppelklicken (Minecraft-Server, Fenster offen lassen).
2. `start-game.bat` doppelklicken (Spielprogramm).
3. Minecraft starten (Version **26.3**) → Mehrspieler → Server hinzufügen: `localhost` → beitreten.
   Dein Spieler wird automatisch zur Kamera.
4. Testpanel im Browser: http://localhost:3000/panel.html

## TikTok LIVE Studio
- Quelle **Spiel/Fenster** → Minecraft.
- Quelle **Link** → `http://localhost:3000/overlay.html`, Größe 1080 × 1920.
- Ton: Der Bürgermeister spricht über die PC-Lautsprecher, LIVE Studio nimmt den PC-Ton mit.

## Einstellungen
In `config.json` (wird nicht hochgeladen, enthält das RCON-Passwort):
TikTok-Name, Minecraft-Name, Name und Stimme des Bürgermeisters, Punkte pro Like/Coin.
Vorlage: `config.example.json`.

## Aufbau
- `src/levels.js` – die 20 Hausstufen
- `src/city.js` – Stadtplan, Baupläne für Häuser und Gemeinschaftsbauten
- `src/builder.js` – Bau-Animation, Kamera, Feuerwerk
- `src/game.js` – Spielregeln, Punkte, Sprüche des Bürgermeisters
- `src/tiktok.js` – Verbindung zum LIVE
- `src/speech.js` – Stimme
- `public/overlay.html`, `public/panel.html` – Overlay und Testpanel
