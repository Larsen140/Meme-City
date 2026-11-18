// Schneidet den Kino-Trailer aus data/video/viral/roh2.mp4 + Stimme + Musik.
// Laeuft mit niedriger Prioritaet, damit ein laufender Stream nicht ruckelt.
// Aufruf: node tools/trailer-schnitt.mjs   ->  branding/meme-city-trailer.mp4
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
const FF = 'C:/Users/larse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const D = 'data/video/trailer', SRC = 'data/video/viral/roh2.mp4';
for (const f of ['bahnschrift', 'impact']) if (!fs.existsSync(`${D}/${f}.ttf`)) fs.copyFileSync(`C:/Windows/Fonts/${f}.ttf`, `${D}/${f}.ttf`);
const FONT = `${D}/bahnschrift.ttf`, IMPACT = `${D}/impact.ttf`;
const { LINES, TOTAL } = JSON.parse(fs.readFileSync(`${D}/zeiten.json`));

function ff(args) {
  return new Promise((res, rej) => {
    const p = spawn(FF, ['-y', '-loglevel', 'error', '-threads', '3', ...args], { stdio: 'inherit' });
    try { os.setPriority(p.pid, os.constants.priority.PRIORITY_LOW); } catch {}
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
}

// Szenen: src = Startzeit im Rohmaterial, d = Laenge im Trailer, speed = Zeitraffer
const GRADE = 'eq=contrast=1.12:saturation=1.22:gamma=0.96,colorbalance=rs=-0.05:bs=0.07:rh=0.07:bh=-0.05';
const SEGS = [
  { src: 113.0, d: 1.8, zoom: 0.08 },                       // Tornado (Kaltstart)
  { card: true, d: 0.9 },                                   // EINE STADT.
  { src: 6.0, d: 3.0, zoom: 0.05 },                         // Stadtplatz
  { src: 27.0, d: 2.2, zoom: 0.04 },                        // Windmuehle
  { src: 49.0, d: 2.2, zoom: 0.04 },                        // Pyramide
  { src: 70.0, d: 2.6, speed: 1.4, zoom: 0.05 },            // Abriss + Bauarbeiter
  { src: 73.6, d: 2.6, speed: 1.4, zoom: 0.05 },            // Haus waechst
  { card: true, d: 1.05 },                                  // DOCH ...
  { src: 130.5, d: 1.4, zoom: 0.1, flash: true, bright: true }, // Meteoriten
  { src: 145.8, d: 1.5, zoom: 0.1, flash: true },           // Tsunami
  { src: 115.5, d: 1.3, zoom: 0.1, flash: true },           // Tornado
  { src: 210.3, d: 1.7, zoom: 0.06, flash: true },          // Flugzeug
  { src: 169.5, d: 3.4, zoom: 0.06, flash: true },          // Feuerwerk
  { src: 172.9, d: TOTAL - 25.6, zoom: 0.04, end: true },   // Abschluss-Hintergrund
];

let t = 0;
const parts = [];
for (let i = 0; i < SEGS.length; i++) {
  const s = SEGS[i], out = `${D}/seg${i}.mp4`;
  s.at = t; t += s.d; parts.push(out);
  if (s.card) {
    await ff(['-f', 'lavfi', '-i', `color=c=black:s=1080x1920:r=30:d=${s.d}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out]);
    continue;
  }
  const sp = s.speed || 1, z = s.zoom || 0;
  let vf = `setpts=(PTS-STARTPTS)/${sp},${GRADE}`;
  if (s.bright) vf += ',eq=brightness=0.06:gamma=1.5:saturation=1.3';
  vf += `,scale=w='trunc(1080*(1+${z}*t/${s.d})/2)*2':h=-2:eval=frame:flags=bicubic,crop=1080:1920`;
  if (s.flash) vf += ',fade=t=in:st=0:d=0.18:color=white';
  if (s.end) vf += ',gblur=sigma=14,eq=brightness=-0.22:saturation=0.8';
  vf += ',vignette=PI/4.5,fps=30';
  await ff(['-ss', String(s.src), '-t', String(s.d * sp + 0.1), '-i', SRC, '-vf', vf, '-t', String(s.d), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out]);
  console.log('Szene', i, 'fertig');
}
fs.writeFileSync(`${D}/liste.txt`, parts.map((p) => `file '${p.split('/').pop()}'`).join('\n'));
await ff(['-f', 'concat', '-safe', '0', '-i', `${D}/liste.txt`, '-c', 'copy', `${D}/bild.mp4`]);

// ---------- Texte ----------
const txt = (name, s) => { fs.writeFileSync(`${D}/${name}.txt`, s); return `${D}/${name}.txt`; };
const a = (s, e, f = 0.25) => `if(lt(t,${s}),0,if(lt(t,${s + f}),(t-${s})/${f},if(lt(t,${e - f}),1,if(lt(t,${e}),(${e}-t)/${f},0))))`;
const T = [];
const draw = (file, { font = FONT, size, color = 'white', x = '(w-tw)/2', y, s, e, border = 0, extra = '' }) =>
  T.push(`drawtext=fontfile=${font}:textfile=${file}:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}:alpha='${a(s, e)}':shadowcolor=black@0.7:shadowx=4:shadowy=4` +
    (border ? `:borderw=${border}:bordercolor=black@0.85` : '') + extra + `:enable='between(t,${s},${e})'`);
// Kaltstart-Hook
draw(txt('h1', 'DIESE STADT'), { font: IMPACT, size: 118, y: 330, s: 0.1, e: 1.8, border: 6 });
draw(txt('h2', 'BAUT DER CHAT'), { font: IMPACT, size: 118, color: '0xFFC93C', y: 460, s: 0.25, e: 1.8, border: 6 });
// Schwarzbilder
draw(txt('c1', 'EINE STADT.'), { size: 96, color: '0xF2E6C9', y: '(h-th)/2', s: 1.85, e: 2.7 });
draw(txt('c2', 'DOCH ...'), { size: 110, color: '0xE8483B', y: '(h-th)/2', s: 15.35, e: 16.35 });
// Untertitel zur Stimme (viele schauen ohne Ton)
LINES.forEach((l, i) => {
  if (i === 4) return; // Schluss steht als Titel im Bild
  const len = [2.5, 2.5, 2.3, 2.3][i];
  draw(txt('u' + i, l.text), { size: 54, y: 1430, s: l.t, e: Math.min(l.t + len, i === 3 ? 16.3 : 99), border: 3 });
});
// Chat-Einblendungen beim Hausbau
const pill = (file, s, e, color) => T.push(`drawtext=fontfile=${FONT}:textfile=${file}:fontsize=50:fontcolor=white:x=70:y=260:box=1:boxcolor=${color}@0.88:boxborderw=22:alpha='${a(s, e, 0.15)}':enable='between(t,${s},${e})'`);
pill(txt('p1', '@DeinName:  Haus'), 10.25, 12.6, '0x1B1240');
pill(txt('p2', '+ 4000 Likes  ->  Stufe 6'), 12.85, 15.2, '0xE0245E');
// Katastrophen-Woerter
[['METEORITEN', 16.35, 17.7], ['TSUNAMI', 17.75, 19.2], ['TORNADO', 19.25, 20.5], ['FLUGSHOW', 20.55, 22.2]].forEach(([w, s, e], i) =>
  draw(txt('k' + i, w), { font: IMPACT, size: 150, y: 300, s, e, border: 8, color: i % 2 ? 'white' : '0xFFC93C' }));
// Abschluss
draw(txt('e1', 'MEME CITY'), { font: IMPACT, size: 190, color: '0xFFC93C', y: 700, s: 25.65, e: TOTAL, border: 10 });
draw(txt('e2', 'Die Minecraft-Stadt, die ihr im LIVE baut'), { size: 48, y: 930, s: 26.1, e: TOTAL });
T.push(`drawtext=fontfile=${FONT}:textfile=${txt('e3', '  JETZT LIVE  ')}:fontsize=66:fontcolor=white:x=(w-tw)/2:y=1060:box=1:boxcolor=0xE0245E@0.95:boxborderw=20:alpha='${a(26.5, TOTAL)}':enable='between(t,26.5,${TOTAL})'`);
draw(txt('e4', '@memecitymc'), { size: 64, y: 1220, s: 26.8, e: TOTAL, border: 3 });
draw(txt('e5', 'Dein Haus wartet.'), { size: 46, color: '0xF2E6C9', y: 1330, s: 27.3, e: TOTAL });
// Kino-Balken
T.push('drawbox=x=0:y=0:w=iw:h=96:color=black:t=fill', 'drawbox=x=0:y=ih-96:w=iw:h=96:color=black:t=fill');

// ---------- Ton ----------
const ain = ['-i', `${D}/musik.wav`];
LINES.forEach((_, i) => ain.push('-i', `${D}/stimme${i}/audio.mp3`));
let af = `[1:a]volume=0.9[m];`;
LINES.forEach((l, i) => {
  const ms = Math.round(l.t * 1000);
  af += `[${i + 2}:a]atrim=start=0.2,asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,bass=g=4,aecho=0.8:0.6:60:0.12,volume=2.2,adelay=${ms}|${ms}[v${i}];`;
});
af += `[m]${LINES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${LINES.length + 1}:normalize=0:duration=first,alimiter=limit=0.95[aout]`;

await ff(['-i', `${D}/bild.mp4`, ...ain, '-filter_complex', `[0:v]${T.join(',')}[vout];${af}`, '-map', '[vout]', '-map', '[aout]',
  '-t', String(TOTAL), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'branding/meme-city-trailer.mp4']);
console.log('Trailer fertig: branding/meme-city-trailer.mp4');
