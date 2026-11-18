// Landschaft rund um die Stadt: Waldguertel mit Wiesen und Teichen, dahinter Huegel.
// Laeuft gedrosselt in Bloecken, damit das Spiel nicht einfriert.
// Aufruf: node tools/landschaft.mjs
import fs from 'fs';
import { Minecraft, sleep } from '../src/minecraft.js';

const GROUND = -61, BASE = -60;
const FOREST_IN = 140, FOREST_OUT = 200; // Waldguertel (Abstand von der Mitte)
const HILLS_IN = 205, HILLS_OUT = 250;   // Huegelkette dahinter

const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon, () => {});
let seed = 4242;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// Weiches Rauschen fuer Lichtungen und dichte Stellen
const noise = (x, z) => Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin((x + z) * 0.021) * 0.7;

// ---------- Auftraege sammeln, nach 64er-Bloecken sortiert ----------
const jobs = new Map(); // "bx,bz" -> [{cmd}]
const add = (x, z, cmd) => {
  const k = `${Math.floor(x / 64)},${Math.floor(z / 64)}`;
  if (!jobs.has(k)) jobs.set(k, []);
  jobs.get(k).push(cmd);
};

// Teiche zuerst (damit dort keine Baeume stehen)
const ponds = [];
for (let i = 0; i < 9; i++) {
  const a = rnd() * Math.PI * 2, d = FOREST_IN + 15 + rnd() * (FOREST_OUT - FOREST_IN - 30);
  const px = Math.round(Math.cos(a) * d), pz = Math.round(Math.sin(a) * d), r = 4 + Math.floor(rnd() * 4);
  ponds.push({ x: px, z: pz, r });
  for (let dx = -r - 1; dx <= r + 1; dx++) {
    const w = Math.floor(Math.sqrt((r + 1) ** 2 - dx * dx));
    add(px, pz, `fill ${px + dx} ${GROUND} ${pz - w} ${px + dx} ${GROUND} ${pz + w} sand`);
  }
  for (let dx = -r; dx <= r; dx++) {
    const w = Math.floor(Math.sqrt(r * r - dx * dx));
    add(px, pz, `fill ${px + dx} ${GROUND - 1} ${pz - w} ${px + dx} ${GROUND} ${pz + w} water`);
  }
  add(px, pz, `setblock ${px + r + 1} ${BASE} ${pz} sugar_cane`);
  add(px, pz, `setblock ${px - r} ${BASE} ${pz} lily_pad`);
}
const inPond = (x, z) => ponds.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 4);

// Wald
const TREES = ['minecraft:oak', 'minecraft:birch', 'minecraft:fancy_oak', 'minecraft:spruce', 'minecraft:oak', 'minecraft:birch', 'minecraft:dark_oak', 'minecraft:pine'];
const FLOWERS = ['poppy', 'dandelion', 'cornflower', 'azure_bluet', 'oxeye_daisy', 'allium', 'short_grass', 'short_grass', 'short_grass'];
for (let x = -FOREST_OUT; x <= FOREST_OUT; x += 5) {
  for (let z = -FOREST_OUT; z <= FOREST_OUT; z += 5) {
    const jx = x + Math.floor(rnd() * 4), jz = z + Math.floor(rnd() * 4);
    const d = Math.hypot(jx, jz);
    if (d < FOREST_IN || d > FOREST_OUT || inPond(jx, jz)) continue;
    const n = noise(jx, jz);
    // am Stadtrand lichter, nach aussen dichter
    const density = 0.35 + ((d - FOREST_IN) / (FOREST_OUT - FOREST_IN)) * 0.45 + n * 0.25;
    if (rnd() < density) {
      let tree = pick(TREES);
      if (tree === 'minecraft:dark_oak') tree = 'minecraft:oak'; // dunkle Eiche braucht 2x2 Setzlinge
      add(jx, jz, `place feature ${tree} ${jx} ${BASE} ${jz}`);
    } else {
      for (let k = 0; k < 3; k++) add(jx, jz, `setblock ${jx + Math.floor(rnd() * 4)} ${BASE} ${jz + Math.floor(rnd() * 4)} ${pick(FLOWERS)} keep`);
    }
  }
}

// Huegel (Ellipsoide aus Gras, mit ein paar Fichten obendrauf)
const hills = [];
for (let i = 0; i < 22; i++) {
  const a = (i / 22) * Math.PI * 2 + rnd() * 0.2;
  const d = HILLS_IN + 10 + rnd() * (HILLS_OUT - HILLS_IN - 10);
  hills.push({ x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d), r: 16 + Math.floor(rnd() * 14), h: 10 + Math.floor(rnd() * 16) });
}
for (const hl of hills) {
  for (let y = 0; y < hl.h; y++) {
    const rr = Math.floor(hl.r * Math.sqrt(1 - (y / hl.h) ** 2));
    if (rr < 1) break;
    // Kreis in waagerechte Streifen zerlegen (je 2 Zeilen ein Befehl)
    for (let dx = -rr; dx <= rr; dx += 2) {
      const w = Math.floor(Math.sqrt(rr * rr - dx * dx));
      add(hl.x, hl.z, `fill ${hl.x + dx} ${BASE + y} ${hl.z - w} ${Math.min(hl.x + dx + 1, hl.x + rr)} ${BASE + y} ${hl.z + w} grass_block`);
    }
  }
  for (let k = 0; k < 6; k++) {
    const ang = rnd() * Math.PI * 2, rr = rnd() * hl.r * 0.6;
    const tx = Math.round(hl.x + Math.cos(ang) * rr), tz = Math.round(hl.z + Math.sin(ang) * rr);
    const top = Math.floor(hl.h * Math.sqrt(Math.max(0, 1 - (rr / hl.r) ** 2)));
    add(hl.x, hl.z, `place feature minecraft:spruce ${tx} ${BASE + top} ${tz}`);
  }
}

// ---------- Ausfuehren ----------
const total = [...jobs.values()].reduce((s, a) => s + a.length, 0);
console.log(`${total} Befehle in ${jobs.size} Bereichen`);
let done = 0;
for (const [k, cmds] of jobs) {
  const [bx, bz] = k.split(',').map(Number);
  const x1 = bx * 64 - 48, z1 = bz * 64 - 48, x2 = bx * 64 + 111, z2 = bz * 64 + 111; // mit Rand fuer Baumkronen/Huegel
  await mc.send(`forceload add ${x1} ${z1} ${x2} ${z2}`);
  await sleep(400); // Landschaft laden lassen
  for (const c of cmds) {
    for (let t = 0; t < 8; t++) { // falls die Landschaft noch laedt: kurz warten und nochmal
      const r = await mc.send(c);
      if (!/not loaded/i.test(r)) break;
      await sleep(500);
    }
    if (++done % 40 === 0) await sleep(60); // Spiel nicht ueberlasten
  }
  await mc.send(`forceload remove ${x1} ${z1} ${x2} ${z2}`);
  await mc.send(`forceload add -96 -96 96 96`); // Stadt bleibt geladen (Autos)
  process.stdout.write(`\r${done}/${total}`);
}
await mc.send('kill @e[type=item]');
console.log('\nLandschaft fertig');
process.exit(0);
