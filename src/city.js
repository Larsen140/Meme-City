// Stadtplan und Bauplaene. Alles hier erzeugt nur Minecraft-Befehle (Text),
// ausgefuehrt werden sie in builder.js.
import { levelInfo } from './levels.js';

export const GROUND = -61;      // oberster Grasblock der Superflat-Welt
export const BASE = -60;        // erste Bauhoehe
export const PITCH = 20;        // Abstand der Grundstuecke (15 Grundstueck + 5 Strasse)
export const HALF = 7;          // Grundstueck geht von -7 bis +7 um die Mitte
export const CLEAR_HEIGHT = 64; // so hoch wird beim Abriss geleert

// ---------- Grundstuecks-Raster (Spirale um das Zentrum) ----------

const RESERVED = 1; // Zellen mit |x|<=1 und |z|<=1 sind der Stadtplatz
let spiral = [];

// Deko-Gebaeude am Stadtrand [x, z, Radius]: ab Ring 7 werden Zellen, die sie beruehren, uebersprungen.
// (Ringe bis 6 bleiben unveraendert, damit bestehende Grundstuecksnummern gleich bleiben.)
export const DEKO_ZONES = [[0, -150, 9], [-150, -40, 13], [150, -40, 9], [0, 155, 10], [-95, -175, 32]];
const blocked = (gx, gz) => DEKO_ZONES.some(([x, z, r]) => Math.abs(gx * PITCH - x) < r + 12 && Math.abs(gz * PITCH - z) < r + 12);

function buildSpiral(count) {
  spiral = [];
  for (let r = RESERVED + 1; spiral.length < count; r++) {
    const ring = [];
    // Ring r im Uhrzeigersinn, beginnend oben links
    for (let x = -r; x < r; x++) ring.push([x, -r]);
    for (let z = -r; z < r; z++) ring.push([r, z]);
    for (let x = r; x > -r; x--) ring.push([x, r]);
    for (let z = r; z > -r; z--) ring.push([-r, z]);
    for (const c of ring) if (r < 7 || !blocked(c[0], c[1])) spiral.push(c);
  }
}

/** Mitte (x, z) des Grundstuecks Nummer n (0, 1, 2, ...). */
export function plotCenter(n) {
  if (n >= spiral.length) buildSpiral(n + 200);
  const [gx, gz] = spiral[n];
  return { x: gx * PITCH, z: gz * PITCH };
}

/** Zellen rund um den Stadtplatz fuer Gemeinschaftsbauten. */
export const COMMUNITY_CELLS = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1],
].map(([gx, gz]) => ({ x: gx * PITCH, z: gz * PITCH }));

// ---------- Hilfen ----------

export class Plan {
  constructor() { this.byY = new Map(); }
  add(y, cmd) {
    if (!this.byY.has(y)) this.byY.set(y, []);
    this.byY.get(y).push(cmd);
  }
  fill(x1, y1, z1, x2, y2, z2, block, extra = '') {
    this.add(y1, `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}${extra ? ' ' + extra : ''}`);
  }
  set(x, y, z, block) { this.add(y, `setblock ${x} ${y} ${z} ${block}`); }
  /** Schichten von unten nach oben. */
  layers() {
    return [...this.byY.keys()].sort((a, b) => a - b).map((y) => ({ y, cmds: this.byY.get(y) }));
  }
  get top() { return Math.max(...this.byY.keys()); }
}

/** Waende einer Ebene (Rechteck-Rahmen) mit Fenstern. */
function wallRing(p, x1, z1, x2, z2, y, wall, corner, window, withWindows) {
  if (!withWindows) {
    p.fill(x1, y, z1, x2, y, z1, wall);
    p.fill(x1, y, z2, x2, y, z2, wall);
    p.fill(x1, y, z1, x1, y, z2, wall);
    p.fill(x2, y, z1, x2, y, z2, wall);
  } else {
    p.fill(x1, y, z1, x2, y, z1, window);
    p.fill(x1, y, z2, x2, y, z2, window);
    p.fill(x1, y, z1, x1, y, z2, window);
    p.fill(x2, y, z1, x2, y, z2, window);
    // Pfeiler zwischen den Fenstern
    for (let x = x1; x <= x2; x += 3) { p.set(x, y, z1, wall); p.set(x, y, z2, wall); }
    for (let z = z1; z <= z2; z += 3) { p.set(x1, y, z, wall); p.set(x2, y, z, wall); }
  }
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) p.set(x, y, z, corner);
}

function pyramidRoof(p, x1, z1, x2, z2, y, block) {
  for (let i = 0; x1 - 1 + i <= x2 + 1 - i && z1 - 1 + i <= z2 + 1 - i; i++) {
    p.fill(x1 - 1 + i, y + i, z1 - 1 + i, x2 + 1 - i, y + i, z2 + 1 - i, block);
  }
}

function battlements(p, x1, z1, x2, z2, y, block) {
  for (let x = x1; x <= x2; x += 2) { p.set(x, y, z1, block); p.set(x, y, z2, block); }
  for (let z = z1; z <= z2; z += 2) { p.set(x1, y, z, block); p.set(x2, y, z, block); }
}

// ---------- Haus ----------

/**
 * Vorderseite eines Grundstuecks: zeigt immer vom Stadtplatz weg (dort kommt die Kamera her).
 * Gibt Richtung (dx, dz) und den Minecraft-Namen ("north" usw.) zurueck.
 */
export function frontOf(cx, cz) {
  if (Math.abs(cz) >= Math.abs(cx)) return cz < 0 ? { dx: 0, dz: -1, facing: 'north' } : { dx: 0, dz: 1, facing: 'south' };
  return cx < 0 ? { dx: -1, dz: 0, facing: 'west' } : { dx: 1, dz: 0, facing: 'east' };
}

/**
 * Bauplan fuer ein Haus einer bestimmten Stufe (oder eines eigenen Stils).
 * Gibt Schichten, Hoehe und die Hausflaeche zurueck.
 */
export function housePlan(cx, cz, levelOrStyle) {
  const s = typeof levelOrStyle === 'number' ? levelInfo(levelOrStyle) : levelOrStyle;
  const p = new Plan();
  const x1 = cx - Math.floor(s.w / 2), x2 = x1 + s.w - 1;
  const z1 = cz - Math.floor(s.d / 2), z2 = z1 + s.d - 1;
  const floorBlock = s.floorBlock || 'oak_planks';

  // Fundament
  p.fill(x1, GROUND, z1, x2, GROUND, z2, 'polished_andesite');

  for (let f = 0; f < s.floors; f++) {
    const yb = BASE + f * 4;
    const tall = s.floors >= 5; // Hochhaeuser: grosse Fenster
    wallRing(p, x1, z1, x2, z2, yb, s.wall, s.corner, s.window, tall && f > 0);
    wallRing(p, x1, z1, x2, z2, yb + 1, s.wall, s.corner, s.window, true);
    wallRing(p, x1, z1, x2, z2, yb + 2, s.wall, s.corner, s.window, tall);
    // Decke / naechster Boden
    p.fill(x1, yb + 3, z1, x2, yb + 3, z2, floorBlock);
    p.fill(x1, yb + 3, z1, x2, yb + 3, z1, s.corner);
    p.fill(x1, yb + 3, z2, x2, yb + 3, z2, s.corner);
    p.fill(x1, yb + 3, z1, x1, yb + 3, z2, s.corner);
    p.fill(x2, yb + 3, z1, x2, yb + 3, z2, s.corner);
    p.set(cx, yb + 2, cz, 'lantern[hanging=true]');
  }
  // Tuer auf der Vorderseite (zur Kamera hin)
  const fr = s.front || frontOf(cx, cz);
  const dxw = fr.dx > 0 ? x2 : fr.dx < 0 ? x1 : cx, dzw = fr.dz > 0 ? z2 : fr.dz < 0 ? z1 : cz;
  p.add(BASE + 1, `setblock ${dxw} ${BASE} ${dzw} oak_door[half=lower,facing=${fr.facing}]`);
  p.add(BASE + 1, `setblock ${dxw} ${BASE + 1} ${dzw} oak_door[half=upper,facing=${fr.facing}]`);
  p.set(dxw + fr.dx, BASE + 2, dzw + fr.dz, 'lantern[hanging=true]');
  p.set(dxw + fr.dx, BASE + 3, dzw + fr.dz, 'oak_slab[type=top]');

  const roofY = BASE + s.floors * 4;
  if (s.roofType === 'pyramid') {
    pyramidRoof(p, x1, z1, x2, z2, roofY, s.roof);
  } else if (s.roofType === 'flat') {
    battlements(p, x1, z1, x2, z2, roofY, s.roof); // Brüstung
    p.fill(x1 + 1, roofY, z1, x2 - 1, roofY, z1, s.roof);
    p.fill(x1 + 1, roofY, z2, x2 - 1, roofY, z2, s.roof);
    p.fill(x1, roofY, z1 + 1, x1, roofY, z2 - 1, s.roof);
    p.fill(x2, roofY, z1 + 1, x2, roofY, z2 - 1, s.roof);
    if (s.floors >= 9) { // Antenne
      p.fill(cx, roofY, cz, cx, roofY + 6, cz, 'lightning_rod');
      p.set(cx, roofY + 7, cz, 'redstone_lamp[lit=true]');
    }
  } else if (s.roofType === 'castle') {
    battlements(p, x1, z1, x2, z2, roofY, s.wall);
    // Ecktuerme
    const towerTop = roofY + 5;
    for (const [tx, tz] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) {
      for (let y = BASE; y < towerTop; y++) {
        p.fill(tx - 1, y, tz - 1, tx + 1, y, tz + 1, s.corner);
        if (y % 4 === (BASE + 1) % 4 + 0 && y > BASE) p.set(tx, y, tz + (tz === z2 ? 1 : -1), s.window);
      }
      battlements(p, tx - 1, tz - 1, tx + 1, tz + 1, towerTop, s.corner);
      // Spitzdach
      p.fill(tx - 1, towerTop + 1, tz - 1, tx + 1, towerTop + 1, tz + 1, s.roof);
      p.set(tx, towerTop + 2, tz, s.roof);
      p.set(tx, towerTop + 3, tz, 'lightning_rod');
    }
    // Mittelturm
    pyramidRoof(p, cx - 2, cz - 2, cx + 2, cz + 2, roofY, s.roof);
    p.set(cx, roofY + 4, cz, 'gold_block');
  }

  return { layers: p.layers(), top: p.top, x1, z1, x2, z2, door: { x: dxw, z: dzw }, front: fr };
}

/** Garten: Hecke, Weg, Blumen, Laternen. Gibt Befehle zurueck. */
export function gardenCommands(cx, cz, house) {
  const c = [];
  const a = cx - HALF, b = cx + HALF, e = cz - HALF, f = cz + HALF;
  const hedge = 'oak_leaves[persistent=true]';
  c.push(`fill ${a} ${BASE} ${e} ${b} ${BASE} ${e} ${hedge}`);
  c.push(`fill ${a} ${BASE} ${f} ${b} ${BASE} ${f} ${hedge}`);
  c.push(`fill ${a} ${BASE} ${e} ${a} ${BASE} ${f} ${hedge}`);
  c.push(`fill ${b} ${BASE} ${e} ${b} ${BASE} ${f} ${hedge}`);
  // Weg von der Tuer zur Strasse (auf der Vorderseite)
  const fr = house.front || frontOf(cx, cz);
  const ex = cx + fr.dx * HALF, ez = cz + fr.dz * HALF; // Eingang in der Hecke
  const px = fr.dx ? 0 : 1, pz = fr.dz ? 0 : 1;         // quer zur Laufrichtung
  c.push(`fill ${house.door.x + fr.dx} ${GROUND} ${house.door.z + fr.dz} ${ex} ${GROUND} ${ez} dirt_path`);
  c.push(`fill ${ex - px} ${BASE} ${ez - pz} ${ex + px} ${BASE} ${ez + pz} air`);
  // Strassenlaternen an den Ecken
  c.push(...lampCommands(cx, cz));
  // Laternen am Eingang
  for (const k of [-2, 2]) {
    c.push(`setblock ${ex + px * k} ${BASE} ${ez + pz * k} oak_fence`);
    c.push(`setblock ${ex + px * k} ${BASE + 1} ${ez + pz * k} lantern`);
  }
  // Blumen (feste Auswahl je Grundstueck, damit es nicht jedes Mal anders aussieht)
  const flowers = ['poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley'];
  let seed = Math.abs(cx * 31 + cz * 17) + 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 18; i++) {
    const x = a + 1 + Math.floor(rnd() * (b - a - 1));
    const z = e + 1 + Math.floor(rnd() * (f - e - 1));
    const insideHouse = x >= house.x1 - 2 && x <= house.x2 + 2 && z >= house.z1 - 2 && z <= house.z2 + 2;
    if (insideHouse || (fr.dx ? z === cz : x === cx)) continue;
    c.push(`setblock ${x} ${BASE} ${z} ${flowers[Math.floor(rnd() * flowers.length)]} keep`);
  }
  return c;
}

/** Strassen rund um ein Grundstueck. */
export function roadCommands(cx, cz) {
  const r = HALF + 5; // 12
  return [
    `fill ${cx - r} ${GROUND} ${cz - r} ${cx + r} ${GROUND} ${cz - r + 4} gray_concrete replace grass_block`,
    `fill ${cx - r} ${GROUND} ${cz + r - 4} ${cx + r} ${GROUND} ${cz + r} gray_concrete replace grass_block`,
    `fill ${cx - r} ${GROUND} ${cz - r} ${cx - r + 4} ${GROUND} ${cz + r} gray_concrete replace grass_block`,
    `fill ${cx + r - 4} ${GROUND} ${cz - r} ${cx + r} ${GROUND} ${cz + r} gray_concrete replace grass_block`,
    // Mittellinien
    `fill ${cx - HALF} ${GROUND} ${cz - 10} ${cx + HALF} ${GROUND} ${cz - 10} white_concrete`,
    `fill ${cx - HALF} ${GROUND} ${cz + 10} ${cx + HALF} ${GROUND} ${cz + 10} white_concrete`,
    `fill ${cx - 10} ${GROUND} ${cz - HALF} ${cx - 10} ${GROUND} ${cz + HALF} white_concrete`,
    `fill ${cx + 10} ${GROUND} ${cz - HALF} ${cx + 10} ${GROUND} ${cz + HALF} white_concrete`,
    // Gehwege an beiden Strassenraendern
    ...[-12, -8, 8, 12].flatMap((o) => [
      `fill ${cx - HALF} ${GROUND} ${cz + o} ${cx + HALF} ${GROUND} ${cz + o} smooth_stone replace gray_concrete`,
      `fill ${cx + o} ${GROUND} ${cz - HALF} ${cx + o} ${GROUND} ${cz + HALF} smooth_stone replace gray_concrete`,
    ]),
  ];
}

/** Geruest an den Hausecken und gelber Kran. */
export function scaffoldCommands(cx, cz, house, top) {
  const c = [];
  for (const [x, z] of [[house.x1 - 1, house.z1 - 1], [house.x2 + 1, house.z1 - 1], [house.x1 - 1, house.z2 + 1], [house.x2 + 1, house.z2 + 1]]) {
    c.push(`fill ${x} ${BASE} ${z} ${x} ${top} ${z} oak_fence keep`);
  }
  // Kran auf der Seite zum Stadtplatz hin (die Kamera schaut von aussen, so steht er nicht im Bild)
  const sx = cx > 0 ? 1 : -1, sz = cz > 0 ? 1 : -1;
  const kx = cx - sx * HALF, kz = cz - sz * HALF, ky = top + 4, hx = cx - sx * 2;
  c.push(`fill ${kx} ${BASE} ${kz} ${kx} ${ky} ${kz} yellow_concrete`);
  c.push(`fill ${Math.min(kx, hx)} ${ky} ${kz} ${Math.max(kx, hx)} ${ky} ${kz} yellow_concrete`);
  c.push(`fill ${hx} ${ky - 3} ${kz} ${hx} ${ky - 1} ${kz} iron_chain`);
  return c;
}

export function removeScaffoldCommands(cx, cz, top) {
  const a = cx - HALF, b = cx + HALF, e = cz - HALF, f = cz + HALF;
  return [
    `fill ${a} ${BASE} ${e} ${b} ${top + 4} ${f} air replace oak_fence`,
    `fill ${a} ${BASE} ${e} ${b} ${top + 4} ${f} air replace yellow_concrete`,
    `fill ${a} ${BASE} ${e} ${b} ${top + 4} ${f} air replace iron_chain`,
  ];
}

/** Grundstueck komplett leeren (Haus, Garten), Boden wieder Gras. */
export function clearPlotCommands(cx, cz) {
  const a = cx - HALF, b = cx + HALF, e = cz - HALF, f = cz + HALF;
  return [
    `fill ${a} ${BASE} ${e} ${b} ${BASE + CLEAR_HEIGHT} ${f} air`,
    `fill ${a} ${GROUND} ${e} ${b} ${GROUND} ${f} grass_block`,
    // Baumkronen, die ueber das Grundstueck hinaus auf die Strasse ragen, auch entfernen
    `fill ${cx - 12} ${BASE} ${cz - 12} ${cx + 12} ${BASE + 30} ${cz + 12} air replace #minecraft:leaves`,
    `fill ${cx - 12} ${BASE} ${cz - 12} ${cx + 12} ${BASE + 30} ${cz + 12} air replace #minecraft:logs`,
  ];
}

// ---------- Gemeinschaftsbauten ----------

export const COMMUNITY_PROJECTS = [
  { name: 'Rathaus',      goal: 1000 },
  { name: 'Fußballplatz', goal: 2000 },
  { name: 'Freibad',      goal: 3000 },
  { name: 'Bar',          goal: 2500 },
  // big: belegt 4 freie Grundstuecke am Stadtrand (siehe bigbuild.js), sonst ein Platz am Stadtplatz
  { name: 'Kino',         goal: 4000, big: true },
  { name: 'Leuchtturm',   goal: 3000 },
  { name: 'Erlebnisbad',  goal: 5000, big: true },
  { name: 'Eisdiele',     goal: 3500 },
  { name: 'Stadion',      goal: 5000 },
  { name: 'Einkaufszentrum', goal: 6000, big: true },
  { name: 'Feuerwehr',    goal: 6000, big: true },
  { name: 'Schule',       goal: 7000, big: true },
  { name: 'Polizei',      goal: 7000, big: true },
  { name: 'Krankenhaus',  goal: 8000, big: true },
];

const GENUS = { Bar: 'f', Leuchtturm: 'm', 'Fußballplatz': 'm' }; // sonst saechlich
/** Richtiger Artikel fuer einen Gemeinschaftsbau: art('Bar', 'ein') -> 'eine Bar' */
export function art(name, fall) {
  const g = GENUS[name] || 'n';
  const t = { ein: { m: 'ein', f: 'eine', n: 'ein' }, nom: { m: 'der', f: 'die', n: 'das' }, akk: { m: 'den', f: 'die', n: 'das' }, dat: { m: 'dem', f: 'der', n: 'dem' } }[fall][g];
  return t + ' ' + name;
}
export const cap = (t) => t[0].toUpperCase() + t.slice(1);

/** Bauplan fuer einen Gemeinschaftsbau (gleiche Form wie housePlan). */
export function communityPlan(name, cx, cz) {
  // Gemeinschaftsbauten schauen zum Brunnen in der Mitte
  const o0 = frontOf(cx, cz), inward = { dx: -o0.dx, dz: -o0.dz, facing: { north: 'south', south: 'north', east: 'west', west: 'east' }[o0.facing] };
  const style = (o) => housePlan(cx, cz, { w: 11, d: 11, floors: 2, roofType: 'pyramid', window: 'glass', front: inward, ...o });
  switch (name) {
    case 'Rathaus': return style({ floors: 3, wall: 'quartz_bricks', corner: 'quartz_pillar', roof: 'green_terracotta', window: 'glass' });
    case 'Bar': return style({ floors: 1, wall: 'dark_oak_planks', corner: 'stripped_dark_oak_log', roof: 'red_concrete', roofType: 'flat', window: 'orange_stained_glass' });
    case 'Eisdiele': return style({ floors: 1, wall: 'pink_concrete', corner: 'white_concrete', roof: 'light_blue_concrete', roofType: 'pyramid', window: 'glass' });
    case 'Kino': return style({ wall: 'black_concrete', corner: 'red_concrete', roof: 'smooth_stone_slab', roofType: 'flat', window: 'yellow_stained_glass' });
    case 'Stadion': return style({ w: 13, d: 13, floors: 2, wall: 'white_concrete', corner: 'light_gray_concrete', roof: 'white_concrete', roofType: 'flat', window: 'green_stained_glass' });
  }
  const p = new Plan();
  if (name === 'Fußballplatz') {
    p.fill(cx - 7, GROUND, cz - 7, cx + 7, GROUND, cz + 7, 'lime_concrete');
    p.fill(cx - 6, GROUND, cz - 7, cx + 6, GROUND, cz + 7, 'green_concrete');
    p.fill(cx - 6, GROUND, cz, cx + 6, GROUND, cz, 'white_concrete');
    for (const z of [cz - 7, cz + 7]) {
      p.fill(cx - 2, BASE, z, cx + 2, BASE + 2, z, 'white_concrete');
      p.fill(cx - 1, BASE, z, cx + 1, BASE + 1, z, 'air');
    }
    p.set(cx, BASE, cz, 'white_wool');
  } else if (name === 'Freibad') {
    p.fill(cx - 7, GROUND, cz - 7, cx + 7, GROUND, cz + 7, 'smooth_quartz');
    p.add(GROUND, `fill ${cx - 5} ${GROUND - 2} ${cz - 5} ${cx + 5} ${GROUND} ${cz + 5} water`);
    p.add(GROUND, `fill ${cx - 5} ${GROUND - 3} ${cz - 5} ${cx + 5} ${GROUND - 3} ${cz + 5} light_blue_concrete`);
    p.fill(cx + 6, BASE, cz - 6, cx + 6, BASE + 3, cz - 6, 'white_concrete');
    p.fill(cx + 5, BASE + 3, cz - 6, cx + 6, BASE + 3, cz - 6, 'white_concrete');
    for (const [x, z] of [[cx - 6, cz + 6], [cx + 6, cz + 6]]) p.set(x, BASE, z, 'red_bed[part=foot,facing=north]');
  } else if (name === 'Leuchtturm') {
    for (let y = BASE; y < BASE + 30; y++) {
      p.fill(cx - 2, y, cz - 2, cx + 2, y, cz + 2, Math.floor((y - BASE) / 4) % 2 ? 'white_concrete' : 'red_concrete', 'hollow');
    }
    p.fill(cx - 3, BASE + 30, cz - 3, cx + 3, BASE + 30, cz + 3, 'smooth_stone');
    p.fill(cx - 1, BASE + 31, cz - 1, cx + 1, BASE + 33, cz + 1, 'glass');
    p.set(cx, BASE + 32, cz, 'sea_lantern');
    p.fill(cx - 1, BASE + 34, cz - 1, cx + 1, BASE + 34, cz + 1, 'red_concrete');
  } else if (name === 'Riesenrad') {
    const r = 7, cy = BASE + r + 2;
    for (let y = BASE; y <= cy; y++) { p.set(cx - 1, y, cz, 'iron_block'); p.set(cx + 1, y, cz, 'iron_block'); }
    for (let i = 0; i < 360; i += 5) {
      const a = (i * Math.PI) / 180;
      const x = cx + Math.round(Math.cos(a) * r), y = cy + Math.round(Math.sin(a) * r);
      p.set(x, y, cz, 'white_concrete');
      if (i % 45 === 0) {
        p.set(x, y - 1, cz, ['red_concrete', 'yellow_concrete', 'lime_concrete', 'light_blue_concrete'][(i / 45) % 4]);
        for (let k = 1; k < r; k += 2) p.set(cx + Math.round(Math.cos(a) * k), cy + Math.round(Math.sin(a) * k), cz, 'iron_bars');
      }
    }
    p.set(cx, cy, cz, 'gold_block');
  }
  return { layers: p.layers(), top: p.top, x1: cx - 5, z1: cz - 5, x2: cx + 5, z2: cz + 5 };
}

/** Stadtplatz in der Mitte mit Brunnen. */
export function plazaCommands() {
  const r = PITCH + HALF; // 27
  return [
    `fill ${-r} ${GROUND} ${-r} ${r} ${GROUND} ${r} smooth_stone replace grass_block`,
    `fill -7 ${GROUND} -7 7 ${GROUND} 7 polished_andesite`,
    `fill -3 ${BASE} -3 3 ${BASE} 3 stone_bricks`,
    `fill -2 ${BASE} -2 2 ${BASE} 2 water`,
    `fill 0 ${BASE} 0 0 ${BASE + 3} 0 quartz_pillar`,
    `setblock 0 ${BASE + 4} 0 water`,
    ...[[-6, -6], [6, -6], [-6, 6], [6, 6]].flatMap(([x, z]) => [
      `fill ${x} ${BASE} ${z} ${x} ${BASE + 2} ${z} dark_oak_fence`,
      `setblock ${x} ${BASE + 3} ${z} lantern`,
    ]),
    // Baeume und Baenke auf dem Platz
    ...[[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([x, z]) => `execute if block ${x} ${BASE} ${z} air run place feature minecraft:fancy_oak ${x} ${BASE} ${z}`),
    ...[[-4, -9], [4, -9], [-4, 9], [4, 9]].flatMap(([x, z]) => [
      `setblock ${x} ${BASE} ${z} spruce_stairs[facing=${z < 0 ? 'south' : 'north'}]`,
      `setblock ${x + 1} ${BASE} ${z} spruce_stairs[facing=${z < 0 ? 'south' : 'north'}]`,
    ]),
  ];
}

/** Strassenlaternen an den vier Ecken eines Grundstuecks. */
export function lampCommands(cx, cz) {
  return [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]].flatMap(([dx, dz]) => [
    `fill ${cx + dx} ${BASE} ${cz + dz} ${cx + dx} ${BASE + 2} ${cz + dz} dark_oak_fence`,
    `setblock ${cx + dx} ${BASE + 3} ${cz + dz} lantern`,
  ]);
}

/** Freies Grundstueck huebsch machen: Baeume, Blumen, Buesche. */
export function freePlotDecoration(cx, cz, n) {
  let seed = n * 7919 + 13;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const c = []; // keine Baeume mehr auf freien Grundstuecken, nur Blumen
  const flowers = ['poppy', 'dandelion', 'cornflower', 'azure_bluet', 'oxeye_daisy', 'allium', 'short_grass', 'short_grass', 'short_grass'];
  for (let i = 0; i < 14; i++) {
    const x = cx - 6 + Math.floor(rnd() * 13), z = cz - 6 + Math.floor(rnd() * 13);
    c.push(`setblock ${x} ${BASE} ${z} ${flowers[Math.floor(rnd() * flowers.length)]} keep`);
  }
  return c;
}

/** Reste von Geruest und Kran entfernen (z. B. wenn ein Bau unterbrochen wurde). */
export function scaffoldCleanupCommands(cx, cz, house) {
  const a = cx - HALF, b = cx + HALF, e = cz - HALF, f = cz + HALF, top = BASE + 70;
  const c = [
    `fill ${a} ${BASE} ${e} ${b} ${top} ${f} air replace yellow_concrete`,
    `fill ${a} ${BASE} ${e} ${b} ${top} ${f} air replace iron_chain`,
    `fill ${a} ${BASE + 1} ${e} ${b} ${top} ${f} air replace oak_fence`, // Gartenzaun steht nur ganz unten
  ];
  for (const [x, z] of [[house.x1 - 1, house.z1 - 1], [house.x2 + 1, house.z1 - 1], [house.x1 - 1, house.z2 + 1], [house.x2 + 1, house.z2 + 1]]) {
    c.push(`execute if block ${x} ${BASE} ${z} oak_fence run setblock ${x} ${BASE} ${z} air`);
  }
  return [...c, ...lampCommands(cx, cz)];
}
