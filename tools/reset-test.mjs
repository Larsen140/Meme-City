// Löscht alle Häuser, Gemeinschaftsbauten und den Speicherstand (Neustart der Stadt).
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { plotCenter, clearPlotCommands, COMMUNITY_CELLS, GROUND, HALF } from '../src/city.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const save = new URL('../data/save.json', import.meta.url);
const mc = new Minecraft(cfg.rcon);
const s = fs.existsSync(save) ? JSON.parse(fs.readFileSync(save)) : { nextPlot: 0 };
const cells = [];
for (let n = 0; n < s.nextPlot; n++) cells.push({ ...plotCenter(n), grass: true });
for (const c of COMMUNITY_CELLS) cells.push({ ...c, grass: false });
for (const c of cells) {
  const a = c.x - HALF - 5, e = c.z - HALF - 5, b = c.x + HALF + 5, f = c.z + HALF + 5;
  await mc.send(`forceload add ${a} ${e} ${b} ${f}`);
  let cmds = clearPlotCommands(c.x, c.z);
  if (!c.grass) cmds = cmds.map((x) => x.replace('grass_block', 'smooth_stone'));
  await mc.sendAll(cmds);
  if (c.grass) await mc.send(`fill ${a} ${GROUND} ${e} ${b} ${GROUND} ${f} grass_block replace gray_concrete`), await mc.send(`fill ${a} ${GROUND} ${e} ${b} ${GROUND} ${f} grass_block replace white_concrete`);
  await mc.send(`fill ${c.x - 7} ${GROUND - 4} ${c.z - 7} ${c.x + 7} ${GROUND - 1} ${c.z + 7} dirt replace water`);
  await mc.send(`fill ${c.x - 7} ${GROUND - 4} ${c.z - 7} ${c.x + 7} ${GROUND - 1} ${c.z + 7} dirt replace light_blue_concrete`);
  await mc.send(`forceload remove ${a} ${e} ${b} ${f}`);
}
await mc.send('kill @e[type=text_display,tag=!mc_title]');
await mc.send('kill @e[type=item]');
if (fs.existsSync(save)) fs.renameSync(save, new URL('../data/save-backup-' + Date.now() + '.json', import.meta.url));
// Bewohner bleiben in der Welt, also nicht noch einmal erschaffen
fs.writeFileSync(save, JSON.stringify({ players: {}, nextPlot: 0, community: { index: 0, progress: 0 }, totals: { coins: 0, likes: 0 }, peopleSpawned: !!s.peopleSpawned }));
console.log(`Fertig: ${cells.length} Flächen geleert, Speicherstand zurückgesetzt.`);
process.exit(0);
