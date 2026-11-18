// Prueft alle bebauten Grundstuecke: steht das Haus vollstaendig und richtig?
// Rechnet den Endzustand des Bauplans aus und vergleicht 40 Stichproben mit der Welt.
// Aufruf: node tools/pruefen.mjs
import fs from 'fs';
import { Rcon } from 'rcon-client';
import { plotCenter, housePlan } from '../src/city.js';
import { levelInfo, MAX_LEVEL } from '../src/levels.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const save = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const r = await Rcon.connect(cfg.rcon);

function finalBlocks(plan) {
  const map = new Map();
  for (const l of plan.layers) for (const c of l.cmds) {
    let m = c.match(/^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) ([a-z_]+)/);
    if (m) {
      const [x1, y1, z1, x2, y2, z2] = m.slice(1, 7).map(Number);
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
          for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) map.set(`${x} ${y} ${z}`, m[7]);
      continue;
    }
    m = c.match(/^setblock (-?\d+) (-?\d+) (-?\d+) ([a-z_]+)/);
    if (m) map.set(`${m[1]} ${m[2]} ${m[3]}`, m[4]);
  }
  return [...map.entries()].filter(([, b]) => b !== 'air');
}

async function score(entries) {
  const sample = entries.sort(() => Math.random() - 0.5).slice(0, 40);
  let ok = 0;
  for (const [pos, block] of sample) if (/passed/.test(await r.send(`execute if block ${pos} ${block}`))) ok++;
  return Math.round((100 * ok) / sample.length);
}

const result = [];
for (const p of Object.values(save.players)) {
  if (p.plot === null) continue;
  const { x, z } = plotCenter(p.plot);
  await r.send(`forceload add ${x - 8} ${z - 8} ${x + 8} ${z + 8}`);
  // Welche Stufe steht da? Gegen die naechstliegenden Stufen pruefen
  let best = { lvl: 0, pct: 0 };
  for (const lvl of new Set([p.builtLevel || 0, p.level, p.level - 1].filter((l) => l >= 1 && l <= MAX_LEVEL))) {
    const plan = housePlan(x, z, p.color ? { ...levelInfo(lvl), roof: `${p.color}_concrete` } : lvl);
    const pct = await score(finalBlocks(plan));
    if (pct > best.pct) best = { lvl, pct };
  }
  await r.send(`forceload remove ${x - 8} ${z - 8} ${x + 8} ${z + 8}`);
  result.push({ name: p.name, plot: p.plot, stufe: p.level, steht_da: best.lvl, passt_prozent: best.pct, ok: best.lvl === p.level && best.pct >= 90 ? 'ja' : 'NEIN' });
}
console.table(result);
r.end();
