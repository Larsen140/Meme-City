// Schneidet das Kino-Video mit allen Features aus data/video/kino/*.mp4 + Stimme + Musik.
// Vorher: node tools/kino-aufnahme.mjs  und  node tools/kino-ton.mjs
// Aufruf: node tools/kino-schnitt.mjs  ->  branding/meme-city-features.mp4
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
const FF = 'C:/Users/larse/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const D = 'data/video/kino';
for (const f of ['bahnschrift', 'impact']) if (!fs.existsSync(`${D}/${f}.ttf`)) fs.copyFileSync(`C:/Windows/Fonts/${f}.ttf`, `${D}/${f}.ttf`);
const FONT = `${D}/bahnschrift.ttf`, IMPACT = `${D}/impact.ttf`;
const { LINES, TOTAL } = JSON.parse(fs.readFileSync(`${D}/zeiten.json`));

function ff(args) {
  return new Promise((res, rej) => {
    const p = spawn(FF, ['-y', '-loglevel', 'error', '-threads', '4', ...args], { stdio: 'inherit' });
    try { os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
}

// Szenen: f = Rohdatei, src = Start darin, d = Laenge im Video, speed = Zeitraffer, label = grosses Wort oben
const GRADE = 'eq=contrast=1.1:saturation=1.25:gamma=0.97,colorbalance=rs=-0.04:bs=0.06:rh=0.06:bh=-0.04';
const SEGS = [
  { f: 'tornado', src: 4.2, d: 1.8, zoom: 0.08 },                                   // Kaltstart
  { f: 'eroeffnung', src: 0.8, d: 3.6, zoom: 0.03 },
  { f: 'mitte', src: 1.5, d: 2.4, zoom: 0.03 },
  { f: 'tafel', src: 1.2, d: 2.2, zoom: 0.03 },
  { f: 'hausbau', src: 4.0, d: 5.0, speed: 2.0, zoom: 0.03 },
  { f: 'flagge', src: 5.0, d: 1.8, zoom: 0.05, label: 'FLAGGEN' },
  { f: 'tierpark', src: 7.7, d: 1.8, zoom: 0.05, label: 'SOGAR DRACHEN' },
  { f: 'gta', src: 0.4, d: 3.0, speed: 1.2, zoom: 0.03, label: 'KAMERAFLUG' },
  { f: 'tierpark', src: 1.0, d: 3.2, zoom: 0.03, label: 'TIERPARK' },
  { f: 'tierpark2', src: 1.0, d: 2.0, zoom: 0.03 },
  { f: 'riesenrad', src: 1.0, d: 3.4, zoom: 0.04, label: 'RIESENRAD' },
  { f: 'burger', src: 1.0, d: 2.2, zoom: 0.04, label: 'BURGER-BUDE' },
  { card: true, d: 1.0 },                                                           // IHR ENTSCHEIDET ...
  { f: 'tornado', src: 5.2, d: 1.4, zoom: 0.1, flash: true, label: 'TORNADO' },
  { f: 'meteor', src: 6.0, d: 1.5, zoom: 0.1, flash: true, label: 'METEORITEN' },
  { f: 'feuerwerk', src: 3.5, d: 3.0, zoom: 0.06, flash: true, label: 'FEUERWERK' },
  { f: 'nacht', src: 3.0, d: 0, zoom: 0.04, end: true },                           // Abschluss
];
let t = 0;
for (const s of SEGS) { if (s.end) s.d = +(TOTAL - t).toFixed(2); s.at = t; t += s.d; }
const parts = [];
for (let i = 0; i < SEGS.length; i++) {
  const s = SEGS[i], out = `${D}/cut${i}.mp4`;
  parts.push(out);
  if (s.card) {
    await ff(['-f', 'lavfi', '-i', `color=c=black:s=1080x1920:r=30:d=${s.d}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
    continue;
  }
  const sp = s.speed || 1, z = s.zoom || 0;
  let vf = `setpts=(PTS-STARTPTS)/${sp},${GRADE}`;
  vf += `,scale=w='trunc(1080*(1+${z}*t/${s.d})/2)*2':h=-2:eval=frame:flags=bicubic,crop=1080:1920`;
  if (s.flash) vf += ',fade=t=in:st=0:d=0.18:color=white';
  if (s.end) vf += ',gblur=sigma=11,eq=brightness=-0.2:saturation=0.85';
  vf += ',vignette=PI/4.5,fps=30';
  await ff(['-ss', String(s.src), '-t', String(s.d * sp + 0.2), '-i', `${D}/${s.f}.mp4`, '-vf', vf, '-t', String(s.d), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
  console.log('Szene', i, s.f, 'fertig');
}
fs.writeFileSync(`${D}/liste.txt`, parts.map((p) => `file '${p.split('/').pop()}'`).join('\n'));
await ff(['-f', 'concat', '-safe', '0', '-i', `${D}/liste.txt`, '-c', 'copy', `${D}/bild.mp4`]);

// ---------- Texte ----------
const txt = (name, s) => { fs.writeFileSync(`${D}/${name}.txt`, s); return `${D}/${name}.txt`; };
const a = (s, e, f = 0.2) => `if(lt(t,${s}),0,if(lt(t,${s + f}),(t-${s})/${f},if(lt(t,${e - f}),1,if(lt(t,${e}),(${e}-t)/${f},0))))`;
const T = [];
const draw = (file, { font = FONT, size, color = 'white', x = '(w-tw)/2', y, s, e, border = 0 }) =>
  T.push(`drawtext=fontfile=${font}:textfile=${file}:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}:alpha='${a(s, e)}':shadowcolor=black@0.7:shadowx=4:shadowy=4` +
    (border ? `:borderw=${border}:bordercolor=black@0.85` : '') + `:enable='between(t,${s},${e})'`);
const pill = (file, s, e, color, y = 250) => T.push(`drawtext=fontfile=${FONT}:textfile=${file}:fontsize=50:fontcolor=white:x=70:y=${y}:box=1:boxcolor=${color}@0.9:boxborderw=22:alpha='${a(s, e, 0.15)}':enable='between(t,${s},${e})'`);
const at = (i) => SEGS[i].at, end = (i) => SEGS[i].at + SEGS[i].d;
// Kaltstart-Hook
draw(txt('h1', 'DIESE STADT'), { font: IMPACT, size: 118, y: 330, s: 0.1, e: 1.8, border: 6 });
draw(txt('h2', 'BAUT DER CHAT'), { font: IMPACT, size: 118, color: '0xFFC93C', y: 460, s: 0.25, e: 1.8, border: 6 });
// Chat-Einblendungen
pill(txt('p1', 'Schreib  „Haus“  in den Chat'), at(3) + 0.1, end(3), '0x1B1240');
pill(txt('p2', '@DeinName:  Haus'), at(4) + 0.1, at(4) + 2.4, '0x1B1240');
pill(txt('p3', '+ Likes  ->  Stufe 7 Bungalow'), at(4) + 2.6, end(4), '0xE0245E');
// Feature-Woerter
SEGS.forEach((s, i) => { if (s.label) draw(txt('l' + i, s.label), { font: IMPACT, size: s.flash ? 150 : 128, y: 280, s: s.at + 0.05, e: s.at + s.d, border: 8, color: i % 2 ? 'white' : '0xFFC93C' }); });
// Schwarzbild
draw(txt('c1', 'UND IHR'), { font: IMPACT, size: 120, color: 'white', y: 820, s: at(12), e: end(12) });
draw(txt('c2', 'ENTSCHEIDET ...'), { font: IMPACT, size: 120, color: '0xE8483B', y: 960, s: at(12) + 0.15, e: end(12) });
// Untertitel zur Stimme (viele schauen ohne Ton)
LINES.forEach((l, i) => {
  if (i === LINES.length - 1) return; // Schluss steht als Titel im Bild
  const next = LINES[i + 1].t;
  // lange Saetze auf zwei Zeilen (jede Zeile einzeln zentriert)
  const words = l.text.split(' '); let rows = [l.text];
  if (l.text.length > 30) { let best = 1; for (let k = 1; k < words.length; k++) if (Math.abs(words.slice(0, k).join(' ').length - l.text.length / 2) < Math.abs(words.slice(0, best).join(' ').length - l.text.length / 2)) best = k; rows = [words.slice(0, best).join(' '), words.slice(best).join(' ')]; }
  rows.forEach((r, k) => draw(txt('u' + i + '_' + k, r), { size: 54, y: 1420 + k * 70, s: l.t, e: Math.min(l.t + 3.2, next - 0.1), border: 3 }));
});
// Abschluss
const E = at(16);
draw(txt('e1', 'MEME CITY'), { font: IMPACT, size: 190, color: '0xFFC93C', y: 640, s: E + 0.3, e: TOTAL, border: 10 });
draw(txt('e2', 'Die Minecraft-Stadt, die ihr im LIVE baut'), { size: 48, y: 870, s: E + 0.7, e: TOTAL });
draw(txt('e3', 'Haus · Haustier · Flagge · Tierpark · Riesenrad'), { size: 42, color: '0x3DF5B0', y: 950, s: E + 1.0, e: TOTAL });
T.push(`drawtext=fontfile=${FONT}:textfile=${txt('e4', '  @memecitymc  ')}:fontsize=66:fontcolor=white:x=(w-tw)/2:y=1070:box=1:boxcolor=0xE0245E@0.95:boxborderw=20:alpha='${a(E + 1.3, TOTAL)}':enable='between(t,${E + 1.3},${TOTAL})'`);
draw(txt('e5', 'Beim nächsten LIVE einziehen!'), { size: 50, color: '0xF2E6C9', y: 1230, s: E + 1.7, e: TOTAL });
// Kino-Balken
T.push('drawbox=x=0:y=0:w=iw:h=96:color=black:t=fill', 'drawbox=x=0:y=ih-96:w=iw:h=96:color=black:t=fill');

// ---------- Ton ----------
const ain = ['-i', `${D}/musik.wav`];
LINES.forEach((_, i) => ain.push('-i', `${D}/stimme${i}/audio.mp3`));
let af = `[1:a]volume=0.85[m];`;
LINES.forEach((l, i) => {
  const ms = Math.round(l.t * 1000);
  af += `[${i + 2}:a]atrim=start=0.2,asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,bass=g=4,aecho=0.8:0.6:60:0.12,volume=2.3,adelay=${ms}|${ms}[v${i}];`;
});
af += `[m]${LINES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${LINES.length + 1}:normalize=0:duration=first,alimiter=limit=0.95[aout]`;

await ff(['-i', `${D}/bild.mp4`, ...ain, '-filter_complex', `[0:v]${T.join(',')}[vout];${af}`, '-map', '[vout]', '-map', '[aout]',
  '-t', String(TOTAL), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'branding/meme-city-features.mp4']);
console.log('Video fertig: branding/meme-city-features.mp4');
