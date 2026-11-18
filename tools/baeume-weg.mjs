// Entfernt alle Baeume auf freien (leeren) Grundstuecken. Laeuft auch neben dem Spielprogramm.
// Aufruf: node tools/baeume-weg.mjs
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { plotCenter, BASE, HALF } from '../src/city.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const s = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const owned = new Set(Object.values(s.players).filter((p) => p.plot !== null).map((p) => p.plot));
const until = Math.max(s.preparedUntil || 0, s.nextPlot);
const mc = new Minecraft(cfg.rcon);
let n0 = 0;
for (let n = 0; n < until; n++) {
  if (owned.has(n)) continue;
  const { x, z } = plotCenter(n), r = 10;
  await mc.send(`forceload add ${x - r} ${z - r} ${x + r} ${z + r}`);
  for (const y of [BASE, BASE + 16]) {
    await mc.send(`fill ${x - HALF} ${y} ${z - HALF} ${x + HALF} ${y + 15} ${z + HALF} air replace #minecraft:logs`);
    await mc.send(`fill ${x - r} ${y} ${z - r} ${x + r} ${y + 15} ${z + r} air replace #minecraft:leaves`);
    await mc.send(`fill ${x - HALF} ${y} ${z - HALF} ${x + HALF} ${y + 15} ${z + HALF} air replace minecraft:bee_nest`);
  }
  await mc.send(`forceload remove ${x - r} ${z - r} ${x + r} ${z + r}`);
  n0++;
}
await mc.send('kill @e[type=item]');
console.log(`Bäume auf ${n0} freien Grundstücken entfernt`);
process.exit(0);
