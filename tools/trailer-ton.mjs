// Erzeugt Ton fuer den Kino-Trailer: Erzaehlerstimme (Edge-TTS) + selbst berechnete Trailer-Musik
// (Drone, BRAAM-Schlaege, Riser, Booms, Streicher-Akkord). Keine fremden Samples.
// Aufruf: node tools/trailer-ton.mjs
import fs from 'fs';
import path from 'path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const D = path.resolve('data/video/trailer');
fs.mkdirSync(D, { recursive: true });
export const LINES = [
  { t: 2.75, text: 'Eine Stadt. Gebaut von euch.' },
  { t: 10.15, text: 'Ein Wort im Chat. Ein Haus.' },
  { t: 12.75, text: 'Jedes Like lässt es wachsen.' },
  { t: 15.35, text: 'Doch Meme City ist nicht sicher.' },
  { t: 25.6, text: 'Meme City. Jetzt live.' },
];
const TOTAL = 29.6;

// ---------- Stimme ----------
const tts = new MsEdgeTTS();
await tts.setMetadata('de-DE-ConradNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
for (let i = 0; i < LINES.length; i++) {
  const d = path.join(D, 'stimme' + i);
  fs.mkdirSync(d, { recursive: true });
  await tts.toFile(d, LINES[i].text, { rate: '-5%', pitch: '-9Hz' });
}
tts.close();

// ---------- Musik ----------
const SR = 44100, N = Math.round(TOTAL * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan); R[i] += v * (1 + pan); } };
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1; })();
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// Tiefer Drone (E), schwillt an, in der Ruhe-Phase leiser
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const env = Math.min(1, t / 2) * (t < 15 ? 0.5 : 0.8) * (t > TOTAL - 1.5 ? (TOTAL - t) / 1.5 : 1);
  const v = (Math.sin(2 * Math.PI * 41.2 * t) * 0.5 + Math.sin(2 * Math.PI * 82.4 * t + Math.sin(t * 0.7)) * 0.25) * env * 0.22;
  add(i, v);
}
// BRAAM: verzerrter, tiefer Saegezahn-Akkord mit langem Ausklang
function braam(t0, len = 2.6, vol = 0.55) {
  const f = [41.2, 41.5, 61.7, 82.4, 82.0, 123.5];
  let lp = 0;
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR, env = Math.min(1, t / 0.015) * Math.exp(-t * 1.3);
    let v = 0;
    for (const fr of f) v += saw(fr * t);
    v = Math.tanh(v * 0.9);
    const cut = 0.04 + 0.25 * Math.exp(-t * 3); // Filter schliesst sich
    lp += (v - lp) * cut;
    add(Math.round(t0 * SR) + i, lp * env * vol);
  }
  boom(t0, 0.5 * vol);
}
// Boom: Sinus-Absturz + Rausch-Schlag
function boom(t0, vol = 0.6) {
  let ph = 0, nz = 0;
  for (let i = 0; i < 1.6 * SR; i++) {
    const t = i / SR, f = 35 + 110 * Math.exp(-t * 9);
    ph += f / SR;
    nz += (rnd() - nz) * 0.15;
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.2) * 1.0 + nz * Math.exp(-t * 18) * 0.8;
    add(Math.round(t0 * SR) + i, v * vol);
  }
}
// Whoosh/Riser: gefiltertes Rauschen + steigender Ton
function riser(t0, len, vol = 0.3) {
  let a = 0, ph = 0;
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR, k = t / len;
    a += (rnd() - a) * (0.02 + 0.5 * k * k);
    ph += (180 + 900 * k * k) / SR;
    const v = (a * 1.4 + Math.sin(2 * Math.PI * ph) * 0.25) * k * k * vol;
    add(Math.round(t0 * SR) + i, v, Math.sin(t * 6) * 0.3);
  }
}
// Uhr-Ticken (Spannung im ruhigen Teil)
function tick(t0, vol = 0.12) { let a = 0; for (let i = 0; i < 0.03 * SR; i++) { a += (rnd() - a) * 0.6; add(Math.round(t0 * SR) + i, a * Math.exp(-i / SR * 200) * vol, 0.4); } }
// Streicher-Akkord (weich, mehrere verstimmte Saegezaehne)
function pad(t0, len, notes, vol = 0.07) {
  let lp = 0;
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR, env = Math.min(1, t / 0.8) * Math.min(1, (len - t) / 1.2);
    let v = 0;
    for (const n of notes) for (const d of [-0.004, 0, 0.005]) v += saw(n * (1 + d) * t);
    lp += (v - lp) * 0.06;
    add(Math.round(t0 * SR) + i, lp * env * vol, Math.sin(t * 0.8) * 0.2);
  }
}

braam(0.05, 2.4, 0.6);                       // Kaltstart mit dem Tornado
boom(1.8, 0.5);                              // Schwarzbild "EINE STADT."
for (let t = 2.7; t < 15.2; t += 0.5) tick(t, t % 1 < 0.01 ? 0.14 : 0.08);
pad(2.7, 12.6, [164.8, 196.0, 246.9], 0.05); // Em, ruhig und schoen
riser(13.3, 2.05, 0.35);                     // Spannung bis "DOCH..."
braam(15.35, 1.0, 0.45);
riser(15.6, 0.75, 0.25);
// Katastrophen-Montage: auf jeden Schnitt ein Schlag
for (const t of [16.35, 17.75, 19.25, 20.55]) braam(t, 1.4, 0.55);
riser(21.3, 0.9, 0.3);
braam(22.2, 3.2, 0.7);                       // Feuerwerk-Hoehepunkt
pad(22.2, 7.2, [130.8, 164.8, 196.0, 261.6], 0.07); // C-Dur: heller Schluss
boom(25.55, 0.7);
boom(TOTAL - 1.3, 0.35);

// Normalisieren und als 16-Bit-WAV schreiben
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
fs.writeFileSync(path.join(D, 'musik.wav'), buf);
fs.writeFileSync(path.join(D, 'zeiten.json'), JSON.stringify({ LINES, TOTAL }, null, 1));
console.log('Ton fertig');
