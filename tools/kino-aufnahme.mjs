// Nimmt Rohmaterial fuer das Kino-Video auf: jede Szene einzeln, mit filmischer Kamerafahrt.
// NUR ausserhalb eines LIVE starten! Aufruf: node tools/kino-aufnahme.mjs [szene ...]
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
const FF = 'C:/Users/larse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const D = 'data/video/kino';
fs.mkdirSync(D, { recursive: true });
const cfg = JSON.parse(fs.readFileSync('config.json'));
const mc = new Minecraft(cfg.rcon, () => {});
const API = 'http://localhost:3000/api';
const post = (p, body = {}) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const B = -60;

const st = await (await fetch(API + '/state')).json();
if (/verbunden mit/.test(String(st.tiktok))) { console.log('LIVE laeuft – keine Aufnahme!'); process.exit(1); }

// Minecraft-Fenster nach vorne holen
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Add-Type @"
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }
"@; $p = Get-Process | Where-Object { $_.MainWindowTitle -like 'Minecraft*' } | Select-Object -First 1; if ($p) { [W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null; [W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null }`]);

// Aufnahme einer Szene (Minecraft-Fenster, Hochformat 1080x1920)
function record(name, secs) {
  const p = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'gdigrab', '-draw_mouse', '0', '-framerate', '30', '-t', String(secs),
    '-i', 'title=Minecraft 26.3 - Multiplayer (3rd-party Server)',
    '-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', `${D}/${name}.mp4`],
  { stdio: ['ignore', 'inherit', 'inherit'] });
  return new Promise((r) => p.on('exit', r));
}

// Weiche Kamerafahrt direkt per Teleport (Kamera vorher fuer die Dauer "gesperrt", damit die Leerlauf-Tour nicht dazwischenfunkt)
const smooth = (t) => t * t * t * (t * (6 * t - 15) + 10);
async function dolly(secs, from, to, lookFrom, lookTo = lookFrom) {
  const start = Date.now();
  for (let done = false; !done;) {
    const r = Math.min(1, (Date.now() - start) / (secs * 1000)); done = r >= 1;
    const t = smooth(r), L = (a, b) => a + (b - a) * t;
    const c = [0, 1, 2].map((k) => L(from[k], to[k])), l = [0, 1, 2].map((k) => L(lookFrom[k], lookTo[k]));
    const dx = l[0] - c[0], dy = l[1] - c[1], dz = l[2] - c[2];
    const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI, pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    await mc.send(`tp @e[tag=mc_cam,limit=1] ${c.map((v) => v.toFixed(2)).join(' ')} ${yaw.toFixed(1)} ${pitch.toFixed(1)}`);
    await wait(0.05);
  }
}
async function shot(name, secs, from, to, lookFrom, lookTo, time) {
  if (time) await mc.send(`time set ${time}`);
  post('/showcase', { shots: [{ x: from[0], y: from[1], z: from[2], lx: lookFrom[0], ly: lookFrom[1], lz: lookFrom[2], sec: 0.6, hold: secs + 1.5 }] });
  await wait(1.6);
  const rec = record(name, secs + 0.6);
  await wait(0.3);
  await dolly(secs, from, to, lookFrom, lookTo);
  await rec;
  await wait(1);
}
const chat = (user, text) => post('/sim/chat', { user, text });
// Szene, deren Kamera das Spiel selbst fuehrt (Hausbau, Flagge, Haustier, Party, GTA-Flug)
async function game(name, secs, fn, lead = 0.4) {
  const rec = record(name, secs);
  await wait(lead);
  await fn();
  await rec;
  await wait(1.5);
}
const idle = async () => { for (let i = 0; i < 120; i++) { const s = await (await fetch(API + '/admin/status')).json(); if (!s.busy && !s.queue) return; await wait(0.5); } };

const ZX = -90, ZZ = 150, pen = (i, j) => [ZX - 15 + 5 * i + 3, ZZ - 15 + 5 * j + 3];
const SCENES = {
  eroeffnung: () => shot('eroeffnung', 8, [0, B + 75, 150], [0, B + 22, 46], [0, B, 0], [0, B + 8, 0], 'noon'),
  mitte: () => shot('mitte', 7, [-16, B + 4, 25], [15, B + 6, 22], [-4, B + 3, 0], [4, B + 4, 0]),
  tafel: () => shot('tafel', 6, [10, B + 20, 36], [0, B + 18, 19], [0, B + 16, 0], [0, B + 16, 0]),
  hausbau: async () => { await idle(); await game('hausbau', 26, () => post('/admin/points', { name: 'DeinName', points: 20 })); },
  flagge: async () => { await idle(); await game('flagge', 9, () => chat('DeinName', 'flagge deutschland')); },
  haustier: async () => { await idle(); await game('haustier', 10, () => chat('DeinName', 'haustier drache')); },
  party: async () => { await idle(); await game('party', 12, () => chat('DeinName', 'party')); },
  tierpark: () => shot('tierpark', 9, [pen(1, 3)[0], B + 5, pen(1, 3)[1] + 5], [pen(5, 3)[0], B + 5, pen(5, 3)[1] + 5], [pen(1, 3)[0] + 1, B + 0.8, pen(1, 3)[1]], [pen(5, 3)[0], B + 0.8, pen(5, 3)[1]]),
  tierpark2: () => shot('tierpark2', 6, [ZX + 22, B + 22, ZZ + 30], [ZX + 8, B + 14, ZZ + 24], [ZX, B, ZZ], [ZX, B, ZZ]),
  riesenrad: () => shot('riesenrad', 9, [-28, B + 3, 182], [-44, B + 6, 174], [-50, B + 16, 150], [-50, B + 17, 150], '12400'),
  burger: () => shot('burger', 6, [92, B + 14, 186], [77, B + 8, 176], [70, B + 8, 150], [70, B + 9, 150], 'noon'),
  gta: async () => {
    await mc.send('time set noon');
    await post('/showcase', { shots: [{ x: 0, y: B + 30, z: 40, lx: 0, ly: B, lz: 0, sec: 1 }] });
    await idle();
    await game('gta', 9, () => chat('DeinName', 'zeig mein haus'), 0.2);
  },
  tornado: async () => { await idle(); post('/event/Tornado'); await wait(4); const rec = record('tornado', 10.6); await wait(0.3); await dolly(10, [-30, B + 4, 78], [10, B + 6, 72], [-50, B + 18, 38], [20, B + 18, 30]); await rec; await idle(); },
  meteor: async () => { await idle(); post('/event/Meteorregen'); await wait(4); const rec = record('meteor', 10.6); await wait(0.3); await dolly(10, [45, B + 34, 70], [30, B + 26, 52], [0, B + 6, 0], [0, B + 2, 0]); await rec; await idle(); },
  feuerwerk: async () => { await idle(); post('/event/Feuerwerk-Show'); await wait(3.5); const rec = record('feuerwerk', 11.6); await wait(0.3); await dolly(11, [0, B + 3, 42], [0, B + 5, 26], [0, B + 22, 0], [0, B + 30, 0]); await rec; await idle(); },
  nacht: () => shot('nacht', 8, [-60, B + 40, 220], [-20, B + 30, 120], [-50, B + 15, 150], [0, B + 5, 0], 'midnight'),
};
const pick = process.argv.slice(2);
for (const [name, fn] of Object.entries(SCENES)) {
  if (pick.length && !pick.includes(name)) continue;
  console.log('Szene:', name);
  await fn();
}
await mc.send('time set noon');
console.log('Aufnahme fertig');
process.exit(0);
