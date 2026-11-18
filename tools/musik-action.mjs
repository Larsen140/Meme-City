// Erzeugt eine energiegeladene, lizenzfreie Hintergrundmusik (128 BPM, Aufbau + Drops) als Stereo-WAV.
// Komplett selbst berechnet – keine fremden Samples, kein Urheberrecht Dritter.
// Aufruf: node tools/musik-action.mjs  ->  assets/musik/meme-city-action.wav
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SR = 32000, BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4, S16 = BEAT / 4, S8 = BEAT / 2;

// Aufbau des Songs (Takte). Akkorde: Am – F – C – G (je 1 Takt)
const SECTIONS = [
  { name: 'intro', bars: 8, pad: 'soft', hats: 'off', arp: 'soft' },
  { name: 'verse', bars: 16, kick: true, clap: true, hats: '8', bass: 'off', arp: 'square', pad: 'soft' },
  { name: 'build', bars: 8, roll: true, riser: true, arp: 'square', pad: 'soft', kickBuild: true },
  { name: 'drop', bars: 16, kick: true, clap: true, hats: '16', bass: 'roll', pad: 'saw', lead: 'big', stab: true, impact: true },
  { name: 'break', bars: 8, pad: 'soft', lead: 'soft', hats: 'off' },
  { name: 'build2', bars: 8, roll: true, riser: true, arp: 'square', pad: 'soft', kickBuild: true },
  { name: 'drop2', bars: 16, kick: true, clap: true, hats: '16', bass: 'roll', pad: 'saw', lead: 'big', stab: true, impact: true, tr: 2, arp: 'square' },
  { name: 'outro', bars: 8, kick: true, hats: '8', pad: 'soft', arp: 'soft', bass: 'off' },
];
const totalBars = SECTIONS.reduce((a, s) => a + s.bars, 0);
const LEN = Math.ceil(totalBars * BAR * SR);
const L = new Float32Array(LEN), R = new Float32Array(LEN);

const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 1073741824 - 1; };
const wave = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  saw: (p) => 2 * (p % 1) - 1,
  square: (p) => ((p % 1) < 0.5 ? 0.8 : -0.8),
};
// "Pumpen" wie beim Sidechain: nach jedem Kick kurz leiser
const pump = (t) => 1 - 0.7 * Math.exp(-((t % BEAT) / BEAT) * 9);

function add(i, v, pan) { if (i >= 0 && i < LEN) { L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } }

function note(type, midi, t0, dur, vol, { pan = 0, a = 0.005, r = 0.06, voices = 1, detune = 0.12, vib = 0, doPump = false } = {}) {
  const i0 = Math.floor(t0 * SR), n = Math.floor((dur + r) * SR);
  const fs_ = Array.from({ length: voices }, (_, k) => m2f(midi + (voices > 1 ? (k / (voices - 1) - 0.5) * 2 * detune : 0)));
  const ph = fs_.map(() => Math.random());
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const env = Math.min(1, t / a) * (t > dur ? Math.max(0, 1 - (t - dur) / r) : 1);
    let v = 0;
    for (let k = 0; k < voices; k++) {
      const f = fs_[k] * (vib ? 1 + vib * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3) : 1);
      ph[k] += f / SR; v += wave[type](ph[k]);
    }
    v = (v / Math.sqrt(voices)) * env * vol * (doPump ? pump(t0 + t) : 1);
    add(i0 + j, v, voices > 1 ? (j % 2 ? 0.15 : -0.15) * pan + pan : pan);
  }
}
function kick(t0, vol = 0.9) {
  const i0 = Math.floor(t0 * SR); let ph = 0;
  for (let j = 0; j < 0.32 * SR; j++) {
    const t = j / SR, f = 48 + 110 * Math.exp(-t * 28);
    ph += f / SR; add(i0 + j, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * vol + (j < 60 ? noise() * 0.25 : 0), 0);
  }
}
function hat(t0, vol, open = false) {
  const i0 = Math.floor(t0 * SR); let last = 0;
  for (let j = 0; j < (open ? 0.18 : 0.04) * SR; j++) { const n = noise(), v = (n - last) * 0.5; last = n; add(i0 + j, v * Math.exp(-(j / SR) * (open ? 14 : 70)) * vol, 0.2); }
}
function clap(t0, vol = 0.45) {
  const i0 = Math.floor(t0 * SR);
  for (let j = 0; j < 0.2 * SR; j++) { const t = j / SR, burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.5 : 1) : 1; add(i0 + j, noise() * Math.exp(-t * 20) * vol * burst, -0.1); }
}
function snare(t0, vol) {
  const i0 = Math.floor(t0 * SR);
  for (let j = 0; j < 0.12 * SR; j++) { const t = j / SR; add(i0 + j, (noise() * 0.8 + Math.sin(2 * Math.PI * 190 * t) * 0.4) * Math.exp(-t * 28) * vol, 0); }
}
function riser(t0, dur, vol) {
  const i0 = Math.floor(t0 * SR); let ph = 0, last = 0;
  for (let j = 0; j < dur * SR; j++) {
    const k = j / (dur * SR), n = noise(), hp = n - last * (0.9 - 0.8 * k); last = n;
    ph += (200 + 1800 * k * k) / SR;
    add(i0 + j, (hp * 0.5 + Math.sin(2 * Math.PI * ph) * 0.25) * k * k * vol, Math.sin(j / SR * 3) * 0.3);
  }
}
function crash(t0, vol = 0.3) {
  const i0 = Math.floor(t0 * SR); let last = 0;
  for (let j = 0; j < 2 * SR; j++) { const n = noise(), v = n - last * 0.5; last = n; add(i0 + j, v * Math.exp(-(j / SR) * 2.2) * vol, (j % 3) * 0.1 - 0.1); }
}

const CH = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]]; // Am F C G
const ROOT = [45, 41, 48, 43];
// Hauptmelodie: [Takt im 4er-Block, Achtel, Ton, Laenge in Achteln]
const MEL = [
  [0, 0, 76, 2], [0, 2, 76, 1], [0, 3, 74, 1], [0, 4, 72, 2], [0, 6, 69, 2],
  [1, 0, 72, 2], [1, 2, 72, 1], [1, 3, 74, 1], [1, 4, 76, 2], [1, 6, 77, 2],
  [2, 0, 79, 3], [2, 3, 76, 1], [2, 4, 76, 2], [2, 6, 72, 2],
  [3, 0, 74, 2], [3, 2, 71, 2], [3, 4, 74, 1], [3, 5, 79, 3],
];
const MEL_END = [[3, 0, 74, 2], [3, 2, 76, 2], [3, 4, 79, 2], [3, 6, 81, 2]];

let bar0 = 0;
for (const s of SECTIONS) {
  const tr = s.tr || 0;
  for (let b = 0; b < s.bars; b++) {
    const t = (bar0 + b) * BAR, c = (b % 4), chord = CH[c].map((m) => m + tr), root = ROOT[c] + tr;
    const prog = b / s.bars; // Fortschritt im Abschnitt (fuer Aufbau)
    // Flaechen
    if (s.pad === 'soft') for (const m of chord) note('tri', m, t, BAR, 0.05, { a: 0.3, r: 0.4, pan: (m % 3 - 1) * 0.3 });
    if (s.pad === 'saw') for (const m of chord) note('saw', m, t, BAR, 0.045, { voices: 3, a: 0.02, r: 0.2, doPump: true, pan: (m % 3 - 1) * 0.4 });
    if (s.stab) for (let k = 0; k < 4; k++) for (const m of chord) note('saw', m + 12, t + k * BEAT + S8, S16 * 1.5, 0.03, { voices: 2, r: 0.04 });
    // Bass
    if (s.bass === 'off') for (let k = 0; k < 4; k++) note('saw', root - 12, t + k * BEAT + S8, S8 * 0.9, 0.16, { r: 0.03 });
    if (s.bass === 'roll') for (let k = 0; k < 16; k++) if (k % 4) note('saw', root - 12 + (k % 4 === 3 ? 12 : 0), t + k * S16, S16 * 0.9, 0.17, { r: 0.02, doPump: true });
    // Arpeggio
    if (s.arp) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12].map((m) => m + 12);
      for (let k = 0; k < 16; k++) note(s.arp === 'soft' ? 'tri' : 'square', tones[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]], t + k * S16, S16 * 0.8, s.arp === 'soft' ? 0.04 : 0.035 * (s.roll ? 0.6 + prog : 1), { r: 0.03, pan: k % 2 ? 0.35 : -0.35 });
    }
    // Melodie
    if (s.lead) {
      const mel = (Math.floor(b / 4) % 2 ? MEL.filter((n) => n[0] < 3).concat(MEL_END) : MEL).filter((n) => n[0] === c);
      for (const [, p, m, l] of mel) {
        if (s.lead === 'big') { note('square', m + tr, t + p * S8, l * S8 * 0.95, 0.09, { vib: 0.006, r: 0.08 }); note('saw', m + tr + 12, t + p * S8, l * S8 * 0.95, 0.035, { voices: 2, r: 0.08 }); }
        else note('tri', m + tr, t + p * S8, l * S8 * 0.95, 0.09, { vib: 0.008, a: 0.03, r: 0.2 });
      }
    }
    // Schlagzeug
    for (let k = 0; k < 4; k++) {
      if (s.kick) kick(t + k * BEAT);
      if (s.kickBuild && (prog < 0.5 || k % 2 === 0 || prog >= 0.75)) kick(t + k * BEAT, 0.7);
      if (s.clap && k % 2 === 1) clap(t + k * BEAT);
    }
    if (s.hats === 'off') for (let k = 0; k < 4; k++) hat(t + k * BEAT + S8, 0.18, true);
    if (s.hats === '8') for (let k = 0; k < 8; k++) hat(t + k * S8, k % 2 ? 0.22 : 0.12, k % 2 === 1);
    if (s.hats === '16') for (let k = 0; k < 16; k++) hat(t + k * S16, k % 4 === 2 ? 0.25 : 0.12, k % 4 === 2);
    // Trommelwirbel im Aufbau: immer dichter und lauter
    if (s.roll) {
      const per = prog < 0.5 ? 4 : prog < 0.75 ? 8 : 16;
      for (let k = 0; k < per; k++) snare(t + (k * BAR) / per, 0.12 + 0.3 * prog);
    }
  }
  if (s.riser) riser(bar0 * BAR, s.bars * BAR, 0.35);
  if (s.impact) crash(bar0 * BAR);
  bar0 += s.bars;
}

// weich begrenzen und normalisieren
let peak = 0;
for (let i = 0; i < LEN; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const g = 0.46 / peak; // etwa so laut wie die alte Musik, damit der Buergermeister gut hoerbar bleibt
const buf = Buffer.alloc(44 + LEN * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + LEN * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'musik', 'meme-city-action.wav');
fs.writeFileSync(out, buf);
console.log(`fertig: ${out} (${Math.round(totalBars * BAR)} s, ${(buf.length / 1e6).toFixed(1)} MB)`);
