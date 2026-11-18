// Setzt das Haus eines Spielers ohne Animation neu (z. B. wenn ein Bau unterbrochen wurde).
// Laeuft auch neben dem Spielprogramm. Aufruf: node tools/haus-neu.mjs <name>
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { Builder } from '../src/builder.js';
const name = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const s = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const p = Object.values(s.players).find((v) => v.name === name);
if (!p || p.plot === null) { console.log('Kein Haus gefunden:', name); process.exit(1); }
const mc = new Minecraft(cfg.rcon);
const b = new Builder(mc, cfg.minecraftName, () => {});
await b.buildHouse(p, true);
console.log(`Neu gesetzt: ${name} (Grundstück ${p.plot}, Stufe ${p.level})`);
process.exit(0);
