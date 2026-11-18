// Setzt bestehende Haustiere einen Block weiter nach vorne (zwischen Hauswand und Hecke),
// damit sie bei grossen Haeusern nicht in der Wand stecken. Nur einmal ausfuehren!
// Laeuft neben dem Spielprogramm (nur Teleport, kein Neustart). Aufruf: node tools/tiere-umsetzen.mjs
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { plotCenter, frontOf } from '../src/city.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const s = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon);
let n = 0;
for (const p of Object.values(s.players).filter((p) => p.plot !== null && (p.pet || p.giftPet))) {
  const { x, z } = plotCenter(p.plot), f = frontOf(x, z);
  // Verschiebung: [entlang der Front, quer dazu]
  const mv = (sel, a, b) => mc.send(`execute as ${sel} at @s run tp @s ~${f.dx * a + (f.dz ? b : 0)} ~ ~${f.dz * a + (f.dx ? b : 0)}`);
  await mc.send(`forceload add ${x - 10} ${z - 10} ${x + 10} ${z + 10}`);
  await mv(`@e[tag=mc_pet_${p.plot},type=!block_display,type=!text_display]`, 1.5, 0.5); // Tiere: auch auf Blockmitte
  await mv(`@e[tag=mc_pet_${p.plot},type=block_display]`, 1, 0);
  await mv(`@e[tag=mc_pet_${p.plot},type=text_display]`, 1, 0);
  await mv(`@e[tag=mc_gift_pet_${p.plot}]`, 1.5, 0.5);
  await mc.send(`forceload remove ${x - 10} ${z - 10} ${x + 10} ${z + 10}`);
  n++;
}
console.log(`Haustiere auf ${n} Grundstücken umgesetzt`);
process.exit(0);
