// Eigenes Auto im Vorgarten: gibt es ab 10.000 Likes pro Person, Farbe per Chat ("auto rot").
import { plotCenter, frontOf, BASE, HALF } from './city.js';
import { levelInfo } from './levels.js';

export const CAR_LIKES = 10_000;
export const CARS_ON = false; // Autos im Vorgarten ausgeschaltet (Larsen, 18.11.2026)

export const CAR_COLORS = {
  rot: 'red', blau: 'blue', hellblau: 'light_blue', türkis: 'cyan', tuerkis: 'cyan', grün: 'lime', gruen: 'lime',
  dunkelgrün: 'green', gelb: 'yellow', orange: 'orange', lila: 'purple', pink: 'pink', rosa: 'pink',
  schwarz: 'black', weiß: 'white', weiss: 'white', grau: 'gray', braun: 'brown', magenta: 'magenta',
};

/** Teile (Front zeigt nach +z): [Block, tx, ty, tz, sx, sy, sz] */
const PARTS = (body) => [
  [body, -0.8, 0.3, -1.6, 1.6, 0.6, 3.2],
  ['black_concrete', -0.85, 0, -1.25, 0.3, 0.5, 0.6], ['black_concrete', 0.55, 0, -1.25, 0.3, 0.5, 0.6],
  ['black_concrete', -0.85, 0, 0.65, 0.3, 0.5, 0.6], ['black_concrete', 0.55, 0, 0.65, 0.3, 0.5, 0.6],
  ['sea_lantern', -0.65, 0.5, 1.58, 0.35, 0.2, 0.05], ['sea_lantern', 0.3, 0.5, 1.58, 0.35, 0.2, 0.05],
  ['redstone_block', -0.65, 0.55, -1.63, 0.3, 0.15, 0.05], ['redstone_block', 0.35, 0.55, -1.63, 0.3, 0.15, 0.05],
  ['light_blue_stained_glass', -0.7, 0.9, -1.0, 1.4, 0.55, 1.7],
  [body, -0.7, 1.45, -1.0, 1.4, 0.1, 1.7],
];

/** Parkplatz im Vorgarten: zwischen Hauswand und Hecke, rechts neben dem Weg. */
export function carSpot(p) {
  const { x: cx, z: cz } = plotCenter(p.plot);
  const f = frontOf(cx, cz);
  const L = levelInfo(p.builtLevel || p.level || 1);
  const wall = Math.floor((f.dx ? L.w : L.d) / 2);
  // Abstand der Lueckenmitte zur Grundstuecksmitte (Weltkoordinaten, Bloecke beginnen bei ganzen Zahlen)
  const off = f.dx + f.dz > 0 ? (wall + 1 + HALF) / 2 : -(wall + HALF - 1) / 2;
  const side = 4.5; // neben dem Weg zur Tuer
  if (f.dx) return { x: cx + off, z: cz + side, yaw: 0 };
  return { x: cx + side, z: cz + off, yaw: 90 };
}

export function parkedCarCommands(p, color = 'red', k = 0.72) {
  const { x, z, yaw } = carSpot(p);
  const tag = `mc_pcar_${p.plot}`;
  const r = (v) => Math.round(v * k * 1000) / 1000;
  return [
    `kill @e[tag=${tag}]`,
    ...PARTS(`${color}_concrete`).map(([b, tx, ty, tz, sx, sy, sz]) =>
      `summon block_display ${x} ${BASE} ${z} {Tags:["mc_pcar","${tag}"],Rotation:[${yaw}f,0f],block_state:"minecraft:${b}",` +
      `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${r(tx)}f,${r(ty)}f,${r(tz)}f],scale:[${r(sx)}f,${r(sy)}f,${r(sz)}f]}}`),
  ];
}
