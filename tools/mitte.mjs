// Stadtmitte schoener machen: Marktstaende, Baenke, Fahnen, Blumen und Azaleen auf den Wegen
// zwischen den Gemeinschaftsbauten. Setzt nur Bloecke, wo Luft ist (keep) – zerstoert nichts.
// Kann gefahrlos mehrmals laufen. Aufruf: node tools/mitte.mjs
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';

const G = -61, B = -60;
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon);
const cmds = [];
const COLORS = ['red', 'yellow', 'light_blue', 'lime', 'orange', 'pink', 'purple', 'cyan'];
const FLOWERS = ['potted_poppy', 'potted_dandelion', 'potted_cornflower', 'potted_allium', 'potted_red_tulip', 'potted_blue_orchid'];

let i = 0;
// 8 Wege zwischen den Gemeinschafts-Plaetzen (5 breit, w = 8..12 vom Rand, s = 13..27 entlang)
for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const vertical of [true, false]) {
  const col = COLORS[i % COLORS.length], col2 = COLORS[(i + 3) % COLORS.length];
  const at = (w, s) => (vertical ? [sx * w, sz * s] : [sx * s, sz * w]);
  const set = (w, s, y, block) => { const [x, z] = at(w, s); cmds.push(`setblock ${x} ${y} ${z} ${block} keep`); };
  // Richtung, in die die Lehne zeigt (nach aussen, man schaut zur Wegmitte)
  const back = vertical ? (sx > 0 ? 'east' : 'west') : (sz > 0 ? 'south' : 'north');

  // 1. Marktstand mit gestreiftem Dach
  for (const [w, s] of [[9, 14], [11, 14], [9, 16], [11, 16]]) for (let y = B; y <= B + 2; y++) set(w, s, y, 'oak_fence');
  for (let w = 9; w <= 11; w++) for (let s = 14; s <= 16; s++) set(w, s, B + 3, `${s === 15 ? 'white' : col}_wool`);
  set(10, 15, B, i % 2 ? 'barrel' : 'smoker');
  set(10, 15, B + 1, i % 2 ? 'potted_red_tulip' : 'lantern');

  // 2. Bank mit zwei Sitzen
  set(11, 20, B, `spruce_stairs[facing=${back}]`);
  set(11, 21, B, `spruce_stairs[facing=${back}]`);
  set(11, 19, B, FLOWERS[i % FLOWERS.length]);
  set(11, 22, B, FLOWERS[(i + 2) % FLOWERS.length]);

  // 3. Fahnenmast
  for (let y = B; y <= B + 5; y++) set(11, 25, y, 'diorite_wall');
  for (const s of [24, 23]) { set(11, s, B + 5, `${col2}_wool`); set(11, s, B + 4, `${col}_wool`); }

  // 4. Bluehende Azalee im Moos
  { const [x, z] = at(10, 26); cmds.push(`execute if block ${x} ${B} ${z} air run setblock ${x} ${G} ${z} moss_block`); }
  set(10, 26, B, 'flowering_azalea');
  i++;
}

// Baenke rund um den Brunnen (auf dem Rand des Mittelfelds, Blick zur Mitte)
for (const [x, z, back] of [[-2, -8, 'north'], [2, -8, 'north'], [-2, 8, 'south'], [2, 8, 'south'], [-8, -2, 'west'], [-8, 2, 'west'], [8, -2, 'east'], [8, 2, 'east']]) {
  cmds.push(`setblock ${x} ${B} ${z} spruce_stairs[facing=${back}] keep`);
}

let bad = 0;
for (const c of cmds) {
  const r = await mc.send(c);
  if (/Unknown|Incorrect|Expected|invalid|Too many/i.test(r)) { bad++; console.log('Problem:', c, '->', r); }
}
await mc.send('kill @e[type=item]');
console.log(`${cmds.length} Befehle, ${bad} Fehler`);
process.exit(bad ? 1 : 0);
