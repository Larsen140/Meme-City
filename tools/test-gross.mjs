// Kurztest: grosse Gemeinschaftsbauten (ohne Minecraft). Aufruf: node tools/test-gross.mjs
import fs from 'fs';
import { findBigSite, bigPlan, bigClearCommands, BIG_HALF } from '../src/bigbuild.js';
import { COMMUNITY_PROJECTS, plotCenter, DEKO_ZONES } from '../src/city.js';
const s = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const used = new Set(Object.values(s.players).filter((p) => p.plot !== null).map((p) => p.plot));
const ok = (c, t) => { console.log((c ? 'OK     ' : 'FEHLER ') + t); if (!c) process.exitCode = 1; };
const taken = new Set();
for (const proj of COMMUNITY_PROJECTS.filter((p) => p.big)) {
  const site = findBigSite(s.nextPlot, taken);
  ok(site && site.plots.every((n) => !used.has(n) && n >= s.nextPlot), `${proj.name}: Grundstücke ${site?.plots.map((n) => n + 1)} bei x=${site?.x} z=${site?.z}`);
  // die vier Grundstuecke liegen wirklich im Quadrat um die Mitte
  ok(site.plots.every((n) => { const c = plotCenter(n); return Math.abs(c.x - site.x) === 10 && Math.abs(c.z - site.z) === 10; }), '  bilden ein 2x2-Quadrat');
  ok(!DEKO_ZONES.some(([x, z, r]) => Math.abs(site.x - x) < r + BIG_HALF && Math.abs(site.z - z) < r + BIG_HALF), '  kein Deko-Gebäude im Weg');
  site.plots.forEach((n) => taken.add(n));
  const plan = bigPlan(proj.name, site.x, site.z);
  const cmds = plan.layers.flatMap((l) => l.cmds);
  const out = cmds.filter((c) => { const m = c.match(/^(?:fill|setblock) (-?\d+) -?\d+ (-?\d+)(?: (-?\d+) -?\d+ (-?\d+))?/); if (!m) return false; return [m[1], m[3]].filter(Boolean).some((v) => Math.abs(v - site.x) > BIG_HALF) || [m[2], m[4]].filter(Boolean).some((v) => Math.abs(v - site.z) > BIG_HALF); });
  ok(out.length === 0, `  ${cmds.length} Befehle, alle innerhalb der Fläche` + (out.length ? ' – ' + out[0] : ''));
  const big = cmds.filter((c) => { const m = c.match(/^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)/); return m && (Math.abs(m[4] - m[1]) + 1) * (Math.abs(m[5] - m[2]) + 1) * (Math.abs(m[6] - m[3]) + 1) > 32768; });
  ok(big.length === 0 && bigClearCommands(site).length > 3, '  keine zu großen fill-Befehle');
}
