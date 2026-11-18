// Kamera-Test: node tools/camtest.mjs <plot> <level> <dist> <hoehe> <ziel-faktor>
import { plotCenter, housePlan, BASE } from '../src/city.js';
import { Rcon } from 'rcon-client';
import fs from 'fs';
const [plot, level, D, H, f] = process.argv.slice(2).map(Number);
const { x, z } = plotCenter(plot);
const h = housePlan(x, z, level).top - BASE;
const len = Math.hypot(x, z) || 1;
const dx = (x / len) * D, dz = (z / len) * D;
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const r = await Rcon.connect(cfg.rcon);
const cmd = `tp ${cfg.minecraftName} ${(x + dx).toFixed(1)} ${BASE + H} ${(z + dz).toFixed(1)} facing ${x} ${BASE + h * f} ${z}`;
console.log('Haushoehe', h, await r.send(cmd));
r.end();
