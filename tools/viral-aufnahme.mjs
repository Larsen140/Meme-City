// Nimmt Rohmaterial fuer den Kino-Trailer auf: Minecraft-Fenster im Hochformat,
// mit filmischen Kamerafahrten (tief, nah, langsam) waehrend der grossen Events.
// NUR ausserhalb eines Lives starten! Aufruf: node tools/viral-aufnahme.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
const FF = 'C:/Users/larse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const D = 'data/video/viral';
fs.mkdirSync(D, { recursive: true });
const cfg = JSON.parse(fs.readFileSync('config.json'));
const mc = new Minecraft(cfg.rcon, () => {});
const API = 'http://localhost:3000/api';
const post = (p, body = {}) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const B = -60;

// Kamerafahrt direkt (waehrend ein Event in der Warteschlange laeuft, ist die Leerlauf-Kamera aus)
const ease = (t) => t * t * (3 - 2 * t);
async function dolly(secs, from, to, lookFrom, lookTo = lookFrom) {
  const start = Date.now();
  for (let done = false; !done;) {
    const r = Math.min(1, (Date.now() - start) / (secs * 1000)); done = r >= 1;
    const t = ease(r), L = (a, b) => a + (b - a) * t;
    const c = [L(from[0], to[0]), L(from[1], to[1]), L(from[2], to[2])];
    const l = [L(lookFrom[0], lookTo[0]), L(lookFrom[1], lookTo[1]), L(lookFrom[2], lookTo[2])];
    const dx = l[0] - c[0], dy = l[1] - c[1], dz = l[2] - c[2];
    const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI, pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    await mc.send(`tp @e[tag=mc_cam,limit=1] ${c.map((v) => v.toFixed(2)).join(' ')} ${yaw.toFixed(1)} ${pitch.toFixed(1)}`);
    await wait(0.05);
  }
}
const showcase = (shots) => post('/showcase', { shots });

const steps = [
  // Eroeffnung: tief ueber den Stadtplatz, Blick zur Pyramide
  ['Stadt', async () => { await showcase([{ x: 45, y: B + 28, z: 85, lx: 0, ly: B + 2, lz: 0, sec: 1.5 }, { x: 4, y: B + 9, z: 22, lx: -95, ly: B + 12, lz: -175, sec: 7, hold: 1 }]); }, 12],
  ['Windmuehle', async () => { await showcase([{ x: 20, y: B + 15, z: -120, lx: 0, ly: B + 11, lz: -146, sec: 1.5 }, { x: -13, y: B + 9, z: -129, lx: 0, ly: B + 12, lz: -146, sec: 7, hold: 0.5 }]); }, 11],
  ['Pyramide', async () => { await post('/showcase', { shots: [{ x: -50, y: B + 24, z: -112, lx: -95, ly: B + 12, lz: -175, sec: 1.5 }, { x: -132, y: B + 14, z: -128, lx: -95, ly: B + 13, lz: -175, sec: 8, hold: 0.5 }] }); }, 12],
  ['Haus', async () => { await post('/sim/like', { user: 'DeinName', count: 4000 }); }, 26],
  ['Tornado', async () => {
    await post('/event/Tornado'); await wait(4);
    await dolly(10, [-30, B + 4, 78], [10, B + 6, 72], [-50, B + 18, 38], [20, B + 18, 30]);
  }, 2],
  ['Meteorregen', async () => {
    await wait(6); await post('/event/Meteorregen'); await wait(4);
    await dolly(10, [28, B + 5, 48], [14, B + 4, 34], [-10, B + 30, -10], [-5, B + 22, -15]);
  }, 2],
  ['Tsunami', async () => {
    await wait(8); await post('/event/Tsunami'); await wait(3.5);
    await dolly(11, [6, B + 3, 48], [6, B + 5, 30], [0, B + 8, -40], [0, B + 10, -60]);
  }, 2],
  ['Feuerwerk', async () => {
    await wait(10); await post('/event/Feuerwerk-Show'); await wait(3.5);
    await dolly(10, [0, B + 3, 42], [0, B + 4, 28], [0, B + 22, 0], [0, B + 30, 0]);
  }, 12],
  ['Flugzeug', async () => { await post('/show/plane'); }, 35],
];
let total = 30; for (const s of steps) total += s[2] + 30; total = Math.min(total, 330);

const rec = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'gdigrab', '-draw_mouse', '0', '-framerate', '30', '-t', String(total),
  '-i', 'title=Minecraft 26.3 - Multiplayer (3rd-party Server)',
  '-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', `${D}/roh2.mp4`],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now() + 300;
await wait(1.5);
const timeline = [];
for (const [name, fn, sec] of steps) {
  timeline.push({ name, at: (Date.now() - t0) / 1000 });
  console.log(name, timeline.at(-1).at.toFixed(1));
  await fn();
  await wait(sec);
}
timeline.push({ name: 'Ende', at: (Date.now() - t0) / 1000 });
rec.stdin.write('q');
await new Promise((r) => rec.on('exit', r));
await mc.send('time set noon');
fs.writeFileSync(`${D}/timeline2.json`, JSON.stringify(timeline, null, 1));
console.log('Aufnahme fertig:', `${D}/roh2.mp4`);
process.exit(0);
