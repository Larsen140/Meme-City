// Erneuert alle "FREI"-Schilder und den Titel im neuen, gut lesbaren Stil.
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { freeSignCommand, signCommand } from '../src/builder.js';
import { plotCenter, BASE } from '../src/city.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const save = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon);
for (let n = save.nextPlot; n < (save.preparedUntil || 0); n++) {
  const { x, z } = plotCenter(n);
  await mc.send(`forceload add ${x} ${z}`);
  await mc.send(`kill @e[tag=mc_plot_${n}]`);
  const r = await mc.send(freeSignCommand(x, z, n));
  if (n === save.nextPlot) console.log(r);
  await mc.send(`forceload remove ${x} ${z}`);
}
await mc.send('kill @e[tag=mc_title]');
await mc.send(signCommand(0, BASE + 8, 0, ['mc_title'], 6, '{text:"MEME CITY",color:"#FFC93C",bold:true}'));
console.log('Schilder erneuert');
process.exit(0);
