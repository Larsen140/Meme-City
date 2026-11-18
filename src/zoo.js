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
    await mc.send(`summon text_display ${cx} ${BASE + (MODELS[a.kind] ? MODELS[a.kind].top * MODELS[a.kind].S + 0.7 : 2.4)} ${cz} {Tags:["mc_zoo"],billboard:"center",background:-1072558032,brightness:{sky:15,block:15},` +
      `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1.2f,1.2f,1.2f]},` +
      `text:{text:${q(a.name + '\n')},color:"#FFC93C",bold:true,extra:[{text:${q('haustier ' + a.key)},color:"#3DF5B0",bold:false}]}}`);
  }
  await mc.send('kill @e[type=item]');
}

/**
 * Kamera-Tour: Ueberblick, dann eine weiche Schlangenlinie an allen Gehegen vorbei.
 * Vor jedem Tier wird kurz abgebremst, damit man es und sein Schild gut sieht.
 */
export async function zooTour(builder, x, z, onAnimal, perAnimal = 1.35) {
  const list = zooAnimals();
  const order = [];
  for (let j = 0; j * COLS < list.length; j++) {
    const row = [];
    for (let i = 0; i < COLS && j * COLS + i < list.length; i++) row.push(j * COLS + i);
    order.push(...(j % 2 ? row.reverse() : row));
  }
  const pts = order.map((n) => penCenter(x, z, n));
  const H = 6, D = 4.5; // Kamera schraeg von oben vor dem Gehege, Schild steht hinter dem Tier
  const smoother = (f) => f * f * f * (f * (6 * f - 15) + 10);
  // 1. Ueberblick von vorne oben
  await builder.camera(x, BASE + 24, z + 32, x, BASE, z);
  await new Promise((r) => setTimeout(r, 2500));
  // 2. weich herunter zum ersten Tier
  await builder.camera(pts[0].x, BASE + H, pts[0].z + D, pts[0].x, BASE + 0.6, pts[0].z, 2.2);
  onAnimal?.(list[order[0]]);
  // 3. an allen Tieren vorbei
  let last = 0;
  await builder.cameraTrack(perAnimal * (pts.length - 1), (t) => {
    const s = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(s)), e = smoother(s - k);
    const a = pts[k], b = pts[k + 1];
    const px = a.x + (b.x - a.x) * e, pz = a.z + (b.z - a.z) * e;
    const near = e < 0.5 ? k : k + 1;
    if (near !== last) { last = near; onAnimal?.(list[order[near]]); }
    return { cam: { x: px, y: BASE + H, z: pz + D }, look: { x: px, y: BASE + 0.6, z: pz } };
  });
  await new Promise((r) => setTimeout(r, 1200));
  // 4. zurueck in den Ueberblick
  await builder.camera(x, BASE + 24, z + 32, x, BASE, z, 2.5);
  await new Promise((r) => setTimeout(r, 1500));
}
