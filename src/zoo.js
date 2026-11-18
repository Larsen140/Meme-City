// Tierpark: alle Haustiere nebeneinander in Gehegen, mit Namensschild und Chat-Befehl.
// Gebaut wird er als Bonus-Bau auf 4 Grundstuecken; "tierpark" im Chat startet eine Kamera-Tour.
import { BASE, GROUND } from './city.js';
import { PETS, MODELS, summonModel } from './action.js';
import { snbtString as q } from './minecraft.js';

const COLS = 6, CELL = 5, HALF_W = 15;

/** Jedes Tier einmal (nach Minecraft-Art), mit Anzeigename und Chat-Wort */
export function zooAnimals() {
  const seen = new Set(), out = [];
  for (const [key, [kind, name]] of Object.entries(PETS)) {
    if (seen.has(kind) || /oe|ae|ue/.test(key)) continue;
    seen.add(kind);
    out.push({ key, kind, name });
  }
  return out;
}

/** Mitte (Weltkoordinate) des Geheges Nummer n */
export function penCenter(x, z, n) {
  const i = n % COLS, j = Math.floor(n / COLS);
  return { x: x - HALF_W + CELL * i + 3, z: z - HALF_W + CELL * j + 3 };
}

const WATER = new Set(['tropical_fish', 'axolotl', 'turtle', 'frog']);

/** Bloecke: Rasen, Zaeune, Wasser fuer Wassertiere, Weg drumherum */
export function zooStatic(p, x, z) {
  const list = zooAnimals(), rows = Math.ceil(list.length / COLS);
  p.fill(x - 16, GROUND, z - 16, x + 16, GROUND, z + 16, 'dirt_path');
  list.forEach((a, n) => {
    const { x: cx, z: cz } = penCenter(x, z, n);
    const x0 = cx - 3, z0 = cz - 3;
    p.fill(x0 + 1, GROUND, z0 + 1, x0 + 4, GROUND, z0 + 4, WATER.has(a.kind) ? 'water' : 'grass_block');
    if (WATER.has(a.kind)) p.add(GROUND, `fill ${x0 + 1} ${GROUND - 1} ${z0 + 1} ${x0 + 4} ${GROUND - 1} ${z0 + 4} sand`);
    // Zaun ringsum (vorne, Richtung +z, niedriger: Hecke statt Zaun, damit man reinschaut)
    p.fill(x0, BASE, z0, x0 + 5, BASE, z0, 'oak_fence');
    p.fill(x0, BASE, z0, x0, BASE, z0 + 5, 'oak_fence');
    p.fill(x0 + 5, BASE, z0, x0 + 5, BASE, z0 + 5, 'oak_fence');
    p.fill(x0 + 1, BASE, z0 + 5, x0 + 4, BASE, z0 + 5, 'flowering_azalea_leaves[persistent=true]');
  });
  // Eingangstor mit Laternen
  for (const s of [-16, 16]) { p.fill(x + s, BASE, z + 16, x + s, BASE + 3, z + 16, 'spruce_log'); p.set(x + s, BASE + 4, z + 16, 'lantern'); }
  return rows;
}

/** Tiere und Schilder setzen (Tags mc_zoo) */
export async function spawnZoo(mc, x, z) {
  await mc.send(`forceload add ${x - 16} ${z - 16} ${x + 16} ${z + 16}`);
  await mc.send('kill @e[tag=mc_zoo]');
  await mc.send('kill @e[tag=mc_pet_zoo]');
  for (const [n, a] of zooAnimals().entries()) {
    const { x: cx, z: cz } = penCenter(x, z, n);
    if (MODELS[a.kind]) await summonModel(mc, a.kind, cx - 0.5, cz - 0.5, 0, 'zoo', a.name);
    else await mc.send(`summon ${a.kind} ${cx} ${BASE} ${cz} {Tags:["mc_zoo"],PersistenceRequired:1b,NoAI:1b,Silent:1b,Invulnerable:1b,Rotation:[0f,0f]}`);
    await mc.send(`summon text_display ${cx} ${BASE + 3.3} ${cz + 1.5} {Tags:["mc_zoo"],billboard:"center",background:-1072558032,brightness:{sky:15,block:15},` +
      `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1.2f,1.2f,1.2f]},` +
      `text:{text:${q(a.name + '\n')},color:"#FFC93C",bold:true,extra:[{text:${q('haustier ' + a.key)},color:"#3DF5B0",bold:false}]}}`);
  }
  await mc.send('kill @e[type=item]');
}

/** Kamera-Tour: erst Ueberblick, dann jede Reihe entlang (jedes Tier ist zu sehen) */
export async function zooTour(builder, x, z, onRow) {
  const rows = Math.ceil(zooAnimals().length / COLS);
  await builder.camera(x, BASE + 26, z + 34, x, BASE, z, undefined);
  await new Promise((r) => setTimeout(r, 3000));
  for (let j = 0; j < rows; j++) {
    const rz = z - HALF_W + CELL * j + 3;
    const xa = x - HALF_W + 3, xb = x - HALF_W + CELL * (COLS - 1) + 3;
    onRow?.(j);
    await builder.camera(xa - 2, BASE + 6, rz + 8, xa, BASE + 1, rz, 1.4);
    await builder.camera(xb + 2, BASE + 6, rz + 8, xb, BASE + 1, rz, 5);
  }
  await builder.camera(x, BASE + 26, z + 34, x, BASE, z, 2.5);
  await new Promise((r) => setTimeout(r, 2000));
}
