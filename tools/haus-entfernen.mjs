// Entfernt das zuletzt vergebene Haus eines Test-Zuschauers wieder (nur wenn das Spielprogramm NICHT laeuft).
// Aufruf: node tools/haus-entfernen.mjs testzuschauer
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { plotCenter, clearPlotCommands, roadCommands, lampCommands, freePlotDecoration, HALF } from '../src/city.js';
import { freeSignCommand } from '../src/builder.js';
const name = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const saveUrl = new URL('../data/save.json', import.meta.url);
const s = JSON.parse(fs.readFileSync(saveUrl));
const [id, p] = Object.entries(s.players).find(([, v]) => v.name === name) || [];
if (!p) { console.log('Nicht gefunden:', name); process.exit(1); }
const n = p.plot;
if (n !== null && n !== s.nextPlot - 1) { console.log(`Grundstück ${n} ist nicht das letzte (${s.nextPlot - 1}) – abgebrochen.`); process.exit(1); }
const mc = new Minecraft(cfg.rcon);
if (n !== null) {
  const { x: cx, z: cz } = plotCenter(n);
  const a = cx - HALF - 5, b = cx + HALF + 5, e = cz - HALF - 5, f = cz + HALF + 5;
  await mc.send(`forceload add ${a} ${e} ${b} ${f}`);
  await mc.sendAll(roadCommands(cx, cz));
  await mc.sendAll(clearPlotCommands(cx, cz));
  await mc.sendAll(lampCommands(cx, cz));
  await mc.sendAll(freePlotDecoration(cx, cz, n));
  await mc.sendAll([`kill @e[tag=mc_plot_${n}]`, `kill @e[tag=mc_pet_${n}]`, `kill @e[tag=mc_gift_pet_${n}]`, freeSignCommand(cx, cz, n)]);
  await mc.send('kill @e[type=item]');
  await mc.send(`forceload remove ${a} ${e} ${b} ${f}`);
  s.nextPlot = n;
}
delete s.players[id];
fs.writeFileSync(saveUrl, JSON.stringify(s));
console.log(`Entfernt: ${name} (Grundstück ${n}). nextPlot = ${s.nextPlot}`);
process.exit(0);
