// Nimmt den Video-Kameraflug im Minecraft-Fenster auf (Hochformat-Ausschnitt).
import { spawn } from 'child_process';
import fs from 'fs';
const FF = 'C:/Users/larse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const shots = [
  { x: 0, y: -5, z: 80, lx: 0, ly: -58, lz: 0, sec: 1.5 },                       // Startposition
  { x: 0, y: -36, z: 40, lx: 0, ly: -56, lz: 0, sec: 4.8 },                      // 1: Willkommen – auf den Platz zu
  { x: -32, y: -46, z: -62.5, lx: -40, ly: -58, lz: -40, sec: 2.6, hold: 3.5 },  // 2: ein Haus von vorne (anfliegen, halten)
  { x: 29.5, y: -42, z: -67, lx: 20, ly: -56.5, lz: -40, sec: 2.6, hold: 2.7 },  // 3: groesseres Haus
  { x: 45, y: -40, z: 45, lx: 0, ly: -48, lz: 0, sec: 2.8, hold: 2.6 },          // 4: Stadt mit Ballons und Autos
  { x: 0, y: -22, z: 62, lx: 0, ly: -52, lz: 0, sec: 4.6, firework: true },      // 5: Feuerwerk, Abschluss
];
const rec = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'gdigrab', '-draw_mouse', '0', '-framerate', '30', '-t', '60',
  '-i', 'title=Minecraft 26.3 - Multiplayer (3rd-party Server)',
  '-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', 'data/video/roh.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
const recStart = Date.now() + 300; // ffmpeg braucht kurz zum Starten
await new Promise((r) => setTimeout(r, 1500));
const res = await fetch('http://localhost:3000/api/showcase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shots }) });
const t = await res.json();
await new Promise((r) => setTimeout(r, 1500));
rec.stdin.write('q');
await new Promise((r) => rec.on('exit', r));
const startOffset = (t.startedAt - recStart) / 1000 + shots[0].sec; // Videobeginn nach der Startposition
const length = (t.endedAt - t.startedAt) / 1000 - shots[0].sec + 1.0;
// (Haltezeiten sind in endedAt enthalten)
fs.writeFileSync('data/video/schnitt.json', JSON.stringify({ startOffset, length }));
console.log({ startOffset, length });
