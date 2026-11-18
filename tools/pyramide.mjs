// Baut eine grosse Pyramide mit Wuestenplatz am noerdlichen Stadtrand (nur einmal ausfuehren).
// Aufruf: node tools/pyramide.mjs
import fs from 'fs';
import { Minecraft, sleep } from '../src/minecraft.js';
import { signCommand } from '../src/builder.js';

const G = -61, B = -60;
const X = -95, Z = -175, R = 24; // Mitte und halbe Grundseite
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon, (m) => { if (/Problem/.test(m)) console.log(m); });
const cmds = [];
const c = (s) => cmds.push(s);
const C = R + 8; // Wuestenplatz drumherum

// Alte Pyramide (stand frueher bei z=-150, zu nah an den Grundstuecken) entfernen
const OLD = { x1: -129, z1: -184, x2: -61, z2: -116 };
c('kill @e[tag=mc_deko_pyramide]');
for (let x = OLD.x1; x <= OLD.x2; x += 8) {
  const x2 = Math.min(x + 7, OLD.x2);
  c(`fill ${x} ${B} ${OLD.z1} ${x2} ${B + 30} ${OLD.z2} air`);
  c(`fill ${x} ${G} ${OLD.z1} ${x2} ${G} ${OLD.z2} grass_block`);
}
// Platz frei machen (auch Huegel)
for (let x = X - C; x <= X + C; x += 8) c(`fill ${x} ${B} ${Z - C} ${Math.min(x + 7, X + C)} ${B + 40} ${Z + C} air`);
// Baeume weg, Sandplatz
for (let x = X - C; x <= X + C; x += 16) {
  const x2 = Math.min(x + 15, X + C);
  c(`fill ${x} ${B} ${Z - C} ${x2} ${B + 30} ${Z + C} air replace #minecraft:leaves`);
  c(`fill ${x} ${B} ${Z - C} ${x2} ${B + 30} ${Z + C} air replace #minecraft:logs`);
  c(`fill ${x} ${B} ${Z - C} ${x2} ${B + 3} ${Z + C} air replace #minecraft:flowers`);
  c(`fill ${x} ${B} ${Z - C} ${x2} ${B + 1} ${Z + C} air replace short_grass`);
  c(`fill ${x} ${G} ${Z - C} ${x2} ${G} ${Z + C} sand`);
}
// Pyramide: Stufen aus Sandstein, jede vierte Lage glatter Sandstein als Zierband
for (let i = 0; i <= R; i++) {
  const r = R - i, y = B + i;
  const block = i === R ? 'gold_block' : i % 4 === 3 ? 'smooth_sandstone' : i % 4 === 1 ? 'cut_sandstone' : 'sandstone';
  if (r > 1) {
    c(`fill ${X - r} ${y} ${Z - r} ${X + r} ${y} ${Z + r} ${block} hollow`);
    // Innen nicht fuellen (spart Befehle), nur der Rand ist sichtbar
  } else c(`fill ${X - r} ${y} ${Z - r} ${X + r} ${y} ${Z + r} ${block}`);
}
// Goldene Spitze
c(`setblock ${X} ${B + R + 1} ${Z} gold_block`);
c(`setblock ${X} ${B + R + 2} ${Z} lightning_rod`);
// Eingang zur Stadt hin (Sueden)
c(`fill ${X - 2} ${B} ${Z + R - 2} ${X + 2} ${B + 4} ${Z + R} air`);
c(`fill ${X - 3} ${B} ${Z + R + 1} ${X - 3} ${B + 5} ${Z + R + 1} chiseled_sandstone`);
c(`fill ${X + 3} ${B} ${Z + R + 1} ${X + 3} ${B + 5} ${Z + R + 1} chiseled_sandstone`);
c(`fill ${X - 3} ${B + 5} ${Z + R + 1} ${X + 3} ${B + 5} ${Z + R + 1} cut_sandstone`);
c(`setblock ${X - 3} ${B + 6} ${Z + R + 1} lantern`);
c(`setblock ${X + 3} ${B + 6} ${Z + R + 1} lantern`);
// Weg aus Sandstein zum Eingang
c(`fill ${X - 1} ${G} ${Z + R + 1} ${X + 1} ${G} ${Z + C} smooth_sandstone`);
// Zwei Obelisken neben dem Weg
for (const dx of [-7, 7]) {
  c(`fill ${X + dx} ${B} ${Z + R + 6} ${X + dx} ${B + 7} ${Z + R + 6} chiseled_sandstone`);
  c(`setblock ${X + dx} ${B + 8} ${Z + R + 6} gold_block`);
}
// Palmen (Dschungelstamm mit Blaetterkrone) in den Ecken
for (const [dx, dz] of [[-R - 5, -R - 5], [R + 5, -R - 5], [-R - 5, R + 5], [R + 5, R + 5], [-12, R + 6], [12, R + 6]]) {
  const x = X + dx, z = Z + dz;
  c(`fill ${x} ${B} ${z} ${x} ${B + 5} ${z} jungle_log`);
  c(`fill ${x - 2} ${B + 6} ${z} ${x + 2} ${B + 6} ${z} jungle_leaves[persistent=true]`);
  c(`fill ${x} ${B + 6} ${z - 2} ${x} ${B + 6} ${z + 2} jungle_leaves[persistent=true]`);
  c(`setblock ${x} ${B + 7} ${z} jungle_leaves[persistent=true]`);
  for (const [a, b] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) c(`setblock ${x + a} ${B + 5} ${z + b} jungle_leaves[persistent=true]`);
}
// Leuchtende Schrift ueber dem Eingang
c(signCommand(X, B + 9, Z + R + 2, ['mc_deko_pyramide'], 3, '{text:"PYRAMIDE",color:"#FFC93C",bold:true}'));

const area = [Math.min(X - C, OLD.x1) - 2, Z - C - 2, Math.max(X + C, OLD.x2) + 2, OLD.z2 + 2];
await mc.send(`forceload add ${area.join(' ')}`);
await sleep(2500);
let n = 0;
for (const cmd of cmds) { await mc.send(cmd); if (++n % 60 === 0) await sleep(40); }
await mc.send('kill @e[type=item]');
await mc.send(`forceload remove ${area.join(' ')}`);
console.log(`Fertig: ${cmds.length} Befehle`);
process.exit(0);
