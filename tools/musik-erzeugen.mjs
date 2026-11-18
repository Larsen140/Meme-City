// Erzeugt eine eigene, lizenzfreie Hintergrundmusik (fröhlicher Chiptune-Loop) als WAV.
// Komplett selbst berechnet – keine fremden Samples, kein Urheberrecht Dritter.
// Aufruf: node tools/musik-erzeugen.mjs  ->  assets/musik/meme-city.wav
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SR = 32000;
const BPM = 104;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// Akkordfolge (je ein Takt): F - G - Em - Am | F - G - C - C  (fröhlich, Stadt-Feeling)
const N = (name) => {
  const m = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const [, n, o] = name.match(/^([A-G]#?)(\d)$/);
  return 440 * Math.pow(2, (m[n] + (Number(o) + 1) * 12 - 69) / 12);
};
const CHORDS = [
  ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['E3', 'G3', 'B3'], ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C3', 'E3', 'G3'], ['C3', 'E3', 'G3'],
];
const BASS = ['F2', 'G2', 'E2', 'A2', 'F2', 'G2', 'C2', 'C2'];
// Melodie: [Takt, Achtel-Position, Ton, Länge in Achteln]; zwei Varianten
const MEL_A = [
  [0, 0, 'C5', 2], [0, 2, 'A4', 1], [0, 3, 'C5', 1], [0, 4, 'F5', 3], [0, 7, 'E5', 1],
  [1, 0, 'D5', 2], [1, 2, 'B4', 1], [1, 3, 'D5', 1], [1, 4, 'G5', 4],
  [2, 0, 'E5', 2], [2, 2, 'D5', 1], [2, 3, 'B4', 1], [2, 4, 'G4', 2], [2, 6, 'B4', 2],
  [3, 0, 'C5', 3], [3, 3, 'A4', 1], [3, 4, 'E5', 4],
  [4, 0, 'F5', 2], [4, 2, 'E5', 1], [4, 3, 'C5', 1], [4, 4, 'A4', 2], [4, 6, 'C5', 2],
  [5, 0, 'D5', 2], [5, 2, 'G5', 2], [5, 4, 'F5', 1], [5, 5, 'E5', 1], [5, 6, 'D5', 2],
  [6, 0, 'E5', 3], [6, 3, 'G5', 1], [6, 4, 'C6', 4],
  [7, 0, 'G5', 2], [7, 2, 'E5', 2], [7, 4, 'C5', 4],
];
const MEL_B = [
  [0, 0, 'A4', 1], [0, 1, 'C5', 1], [0, 2, 'F5', 2], [0, 4, 'A5', 2], [0, 6, 'G5', 2],
  [1, 0, 'B4', 1], [1, 1, 'D5', 1], [1, 2, 'G5', 2], [1, 4, 'B5', 2], [1, 6, 'A5', 2],
  [2, 0, 'G5', 2], [2, 2, 'E5', 2], [2, 4, 'B4', 2], [2, 6, 'E5', 2],
  [3, 0, 'A5', 4], [3, 4, 'G5', 2], [3, 6, 'E5', 2],
  [4, 0, 'F5', 1], [4, 1, 'G5', 1], [4, 2, 'A5', 2], [4, 4, 'C6', 2], [4, 6, 'A5', 2],
  [5, 0, 'G5', 2], [5, 2, 'B5', 2], [5, 4, 'D6', 2], [5, 6, 'B5', 2],
  [6, 0, 'C6', 2], [6, 2, 'G5', 2], [6, 4, 'E5', 2], [6, 6, 'G5', 2],
  [7, 0, 'C6', 6],
];

// Ablauf: Intro (nur Akkorde+Bass), A, B, A mit Drums, Break, B ... => 6 Durchläufe à 8 Takte
const SECTIONS = [
  { mel: null, drums: 1, arp: true },
  { mel: MEL_A, drums: 2, arp: true },
  { mel: MEL_B, drums: 2, arp: true },
  { mel: MEL_A, drums: 2, arp: false },
  { mel: null, drums: 1, arp: true },
  { mel: MEL_B, drums: 2, arp: true },
];
const totalBars = SECTIONS.length * 8;
const len = Math.ceil(totalBars * BAR * SR);
const L = new Float32Array(len), R = new Float32Array(len);

let seed = 7;
const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 1073741824) - 1; };

/** Ton hinzufuegen: Wellenform, Frequenz, Start(s), Dauer(s), Lautstaerke, Stereo-Pan, Huellkurve */
function tone(wave, f, t0, dur, vol, pan = 0, { a = 0.01, d = 0.1, s = 0.6, r = 0.08, vib = 0 } = {}) {
  const i0 = Math.floor(t0 * SR), n = Math.floor((dur + r) * SR);
  let ph = 0;
  for (let i = 0; i < n && i0 + i < len; i++) {
    const t = i / SR;
    let env = t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : t < dur ? s : s * Math.max(0, 1 - (t - dur) / r);
    const fr = f * (1 + vib * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3));
    ph += fr / SR; ph -= Math.floor(ph);
    let v;
    if (wave === 'square') v = ph < 0.5 ? 0.6 : -0.6;
    else if (wave === 'pulse') v = ph < 0.25 ? 0.6 : -0.6;
    else if (wave === 'tri') v = 4 * Math.abs(ph - 0.5) - 1;
    else v = Math.sin(2 * Math.PI * ph);
    v *= env * vol;
    L[i0 + i] += v * (1 - pan) * 0.5 * 2 * 0.5 + v * 0.5;
    R[i0 + i] += v * (1 + pan) * 0.5 * 2 * 0.5 + v * 0.5;
  }
}
function kick(t0, vol) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(0.25 * SR); let ph = 0;
  for (let i = 0; i < n && i0 + i < len; i++) {
    const t = i / SR, f = 50 + 110 * Math.exp(-t * 28);
    ph += f / SR; const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 12) * vol;
    L[i0 + i] += v; R[i0 + i] += v;
  }
}
function hat(t0, vol, open = false) {
  const i0 = Math.floor(t0 * SR), n = Math.floor((open ? 0.12 : 0.04) * SR); let prev = 0;
  for (let i = 0; i < n && i0 + i < len; i++) {
    const x = noise(), hp = x - prev; prev = x; // einfacher Hochpass
    const v = hp * Math.exp(-(i / SR) * (open ? 25 : 70)) * vol;
    L[i0 + i] += v * 0.8; R[i0 + i] += v;
  }
}
function snare(t0, vol) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(0.18 * SR); let ph = 0;
  for (let i = 0; i < n && i0 + i < len; i++) {
    const t = i / SR; ph += 190 / SR;
    const v = (noise() * 0.7 + Math.sin(2 * Math.PI * ph) * 0.4) * Math.exp(-t * 22) * vol;
    L[i0 + i] += v; R[i0 + i] += v;
  }
}

for (let sec = 0; sec < SECTIONS.length; sec++) {
  const S = SECTIONS[sec];
  for (let b = 0; b < 8; b++) {
    const t = (sec * 8 + b) * BAR;
    const ch = CHORDS[b];
    // weiche Flaeche (Pad)
    for (const n of ch) tone('tri', N(n), t, BAR * 0.95, 0.045, 0, { a: 0.25, d: 0.3, s: 0.8, r: 0.3 });
    // Bass: Grundton auf 1 und 3, Oktave dazwischen
    const bf = N(BASS[b]);
    [[0, 1], [1.5, 2], [2, 1], [3, 2], [3.5, 1]].forEach(([beat, oct]) => tone('tri', bf * oct, t + beat * BEAT, BEAT * 0.45, 0.16, 0, { a: 0.005, d: 0.08, s: 0.5, r: 0.04 }));
    // Arpeggio (Achtel)
    if (S.arp) for (let e = 0; e < 8; e++) {
      const f = N(ch[[0, 1, 2, 1, 0, 2, 1, 2][e]]) * 2;
      tone('pulse', f, t + e * BEAT / 2, BEAT * 0.3, 0.035, e % 2 ? 0.4 : -0.4, { a: 0.003, d: 0.06, s: 0.3, r: 0.03 });
    }
    // Schlagzeug
    for (let beat = 0; beat < 4; beat++) {
      const tb = t + beat * BEAT;
      if (beat === 0 || beat === 2 || (S.drums === 2 && beat === 3 && b % 2)) kick(tb + (beat === 3 ? BEAT / 2 : 0), 0.5);
      if (S.drums === 2 && (beat === 1 || beat === 3)) snare(tb, 0.22);
      hat(tb + BEAT / 2, 0.07, beat === 3);
      if (S.drums === 2) hat(tb, 0.04);
    }
  }
  // Melodie
  if (S.mel) for (const [bar, pos, n, l] of S.mel) {
    tone('square', N(n), (sec * 8 + bar) * BAR + pos * BEAT / 2, l * BEAT / 2 * 0.9, 0.06, 0.1, { a: 0.008, d: 0.12, s: 0.55, r: 0.1, vib: 0.006 });
  }
}

// Echo fuer Raum, sanfter Tiefpass, Lautstaerke angleichen
const dly = Math.floor(BEAT * 0.75 * SR);
for (let i = dly; i < len; i++) { L[i] += R[i - dly] * 0.22; R[i] += L[i - dly] * 0.22; }
let lpL = 0, lpR = 0, peak = 0;
for (let i = 0; i < len; i++) { lpL += (L[i] - lpL) * 0.55; lpR += (R[i] - lpR) * 0.55; L[i] = lpL; R[i] = lpR; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
// Anfang und Ende ineinander blenden, damit die Schleife nahtlos ist
const fade = Math.floor(0.02 * SR);
for (let i = 0; i < fade; i++) { const g = i / fade; L[i] *= g; R[i] *= g; L[len - 1 - i] *= g; R[len - 1 - i] *= g; }

const buf = Buffer.alloc(44 + len * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(len * 4, 40);
const g = 0.85 / peak;
for (let i = 0; i < len; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * g * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * g * 32767))), 46 + i * 4);
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'musik', 'meme-city.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
console.log(`Musik erzeugt: ${out} (${(len / SR).toFixed(1)} s, ${(buf.length / 1e6).toFixed(1)} MB)`);
