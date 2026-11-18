// Grosse Gemeinschaftsbauten: belegen 2x2 freie Grundstuecke am Stadtrand (35 x 35 Bloecke).
// Die Grundstuecksnummern bleiben dabei gleich – Haeuser ueberspringen reservierte Nummern einfach.
import { Plan, housePlan, plotCenter, GROUND, BASE, PITCH, frontOf } from './city.js';

/** Halbe Breite der nutzbaren Flaeche um die Mitte des 2x2-Blocks. */
export const BIG_HALF = 16;

/**
 * Sucht 4 noch freie Grundstuecke, die zusammen ein Quadrat bilden.
 * taken: Set mit Grundstuecksnummern, die schon reserviert sind.
 * Gibt { plots, x, z } zurueck (x/z = Mitte des Blocks).
 */
export function findBigSite(nextPlot, taken, buffer = 6) {
  const start = nextPlot + buffer, cells = new Map();
  for (let n = start; n < start + 600; n++) {
    const { x, z } = plotCenter(n);
    cells.set(`${x / PITCH},${z / PITCH}`, n);
  }
  const free = (gx, gz) => { const n = cells.get(`${gx},${gz}`); return n !== undefined && !taken.has(n) ? n : null; };
  for (let n = start; n < start + 600; n++) {
    if (taken.has(n)) continue;
    const { x, z } = plotCenter(n), gx = x / PITCH, gz = z / PITCH;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const four = [free(gx, gz), free(gx + sx, gz), free(gx, gz + sz), free(gx + sx, gz + sz)];
      if (four.every((v) => v !== null)) {
        return { plots: four.sort((a, b) => a - b), x: (gx + (gx + sx)) * PITCH / 2, z: (gz + (gz + sz)) * PITCH / 2 };
      }
    }
  }
  return null;
}

/** Flaeche leer raeumen: Strassen, Laternen, Baeume und Schilder dazwischen weg. */
export function bigClearCommands(site) {
  const { x, z } = site, r = BIG_HALF;
  const c = [];
  for (let y = BASE; y < BASE + 48; y += 16) c.push(`fill ${x - r} ${y} ${z - r} ${x + r} ${y + 15} ${z + r} air`);
  // Baumkronen, die ueber den Rand ragen (in Scheiben, Minecraft erlaubt hoechstens 32768 Bloecke pro fill)
  for (let y = BASE; y < BASE + 32; y += 16) {
    c.push(`fill ${x - r - 4} ${y} ${z - r - 4} ${x + r + 4} ${y + 15} ${z + r + 4} air replace #minecraft:leaves`);
    c.push(`fill ${x - r - 4} ${y} ${z - r - 4} ${x + r + 4} ${y + 15} ${z + r + 4} air replace #minecraft:logs`);
  }
  c.push(`fill ${x - r} ${GROUND} ${z - r} ${x + r} ${GROUND} ${z + r} grass_block`);
  for (const n of site.plots) c.push(`kill @e[tag=mc_plot_${n}]`);
  c.push('kill @e[type=item]');
  return c;
}

// ---------- Bauplaene ----------

const disc = (p, cx, cy, cz, r, block) => {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (dx * dx + dz * dz <= r * r + r) p.set(cx + dx, cy, cz + dz, block);
  }
};

function parking(p, x1, z1, x2, z2) {
  p.fill(x1, GROUND, z1, x2, GROUND, z2, 'gray_concrete');
  for (let x = x1 + 1; x <= x2; x += 4) p.fill(x, GROUND, z1, x, GROUND, z1 + 3, 'white_concrete');
}

function ground(p, x, z, block = 'smooth_stone') {
  p.fill(x - BIG_HALF, GROUND, z - BIG_HALF, x + BIG_HALF, GROUND, z + BIG_HALF, block);
}

/** Front des Blocks zeigt vom Stadtplatz weg – dort steht der Eingang. */
function shift(x, z, along) {
  const f = frontOf(x, z);
  return { x: x + f.dx * along, z: z + f.dz * along, f };
}

export function bigPlan(name, x, z) {
  const p = new Plan();
  const style = (o, along = -3) => {
    const c = shift(x, z, along);
    // d ist immer die Tiefe in Blickrichtung der Front
    const s = c.f.dx ? { ...o, w: o.d, d: o.w } : o;
    const h = housePlan(c.x, c.z, { roofType: 'flat', window: 'glass', front: c.f, ...s });
    for (const l of h.layers) for (const cmd of l.cmds) p.add(l.y, cmd);
    return c;
  };
  ground(p, x, z, 'grass_block');
  if (name === 'Kino') {
    ground(p, x, z);
    const c = style({ w: 29, d: 21, floors: 3, wall: 'black_concrete', corner: 'red_concrete', roof: 'red_concrete', window: 'yellow_stained_glass' });
    // roter Teppich und Leuchtreklame vor dem Eingang
    const fx = c.x + c.f.dx * 11, fz = c.z + c.f.dz * 11;
    for (let i = 0; i < 5; i++) p.set(fx + c.f.dx * i, BASE, fz + c.f.dz * i, 'red_carpet');
    for (const s of [-3, 3]) {
      const lx = fx + (c.f.dz ? s : 0), lz = fz + (c.f.dx ? s : 0);
      p.fill(lx, BASE, lz, lx, BASE + 3, lz, 'yellow_concrete');
      p.set(lx, BASE + 4, lz, 'glowstone');
    }
  } else if (name === 'Erlebnisbad') {
    ground(p, x, z, 'smooth_quartz');
    // grosses Becken (3 tief) und Kinderbecken
    p.add(GROUND, `fill ${x - 12} ${GROUND - 3} ${z - 10} ${x + 4} ${GROUND - 3} ${z + 10} light_blue_concrete`);
    p.add(GROUND, `fill ${x - 12} ${GROUND - 2} ${z - 10} ${x + 4} ${GROUND} ${z + 10} water`);
    p.add(GROUND, `fill ${x + 8} ${GROUND - 1} ${z + 4} ${x + 13} ${GROUND - 1} ${z + 10} cyan_concrete`);
    p.add(GROUND, `fill ${x + 8} ${GROUND} ${z + 4} ${x + 13} ${GROUND} ${z + 10} water`);
    // Rutschturm mit Rutsche ins Becken
    p.fill(x + 7, BASE, z - 12, x + 9, BASE + 9, z - 10, 'white_concrete', 'hollow');
    p.fill(x + 7, BASE + 10, z - 12, x + 9, BASE + 10, z - 10, 'blue_concrete');
    for (let i = 0; i < 10; i++) p.set(x + 6 - i, BASE + 9 - i, z - 11, i % 2 ? 'yellow_concrete' : 'orange_concrete');
    // Sprungbrett
    p.fill(x - 12, BASE, z - 13, x - 12, BASE + 2, z - 13, 'white_concrete');
    p.fill(x - 12, BASE + 2, z - 12, x - 12, BASE + 2, z - 9, 'white_concrete');
    // Liegen und Sonnenschirme
    const colors = ['red', 'yellow', 'lime', 'pink', 'orange', 'light_blue'];
    for (let i = 0; i < 6; i++) {
      const lx = x - 12 + i * 3, lz = z + 13;
      p.fill(lx, BASE, lz, lx + 1, BASE, lz, 'white_carpet');
      p.fill(lx, BASE, lz - 1, lx, BASE + 2, lz - 1, 'oak_fence');
      p.fill(lx - 1, BASE + 3, lz - 2, lx + 1, BASE + 3, lz, `${colors[i]}_wool`);
    }
    for (const [a, b] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) p.set(x + a, BASE, z + b, 'potted_bamboo');
  } else if (name === 'Burger-Bude') {
    ground(p, x, z);
    const c = style({ w: 21, d: 15, floors: 2, wall: 'red_concrete', corner: 'yellow_concrete', roof: 'yellow_concrete', window: 'glass' }, -5);
    // Riesen-Burger auf dem Dach
    const ry = BASE + 9, bx = c.x, bz = c.z;
    disc(p, bx, ry, bz, 5, 'orange_terracotta');
    disc(p, bx, ry + 1, bz, 6, 'lime_concrete');
    disc(p, bx, ry + 2, bz, 5, 'brown_concrete');
    disc(p, bx, ry + 3, bz, 6, 'yellow_concrete');
    disc(p, bx, ry + 4, bz, 5, 'orange_terracotta');
    disc(p, bx, ry + 5, bz, 4, 'orange_terracotta');
    disc(p, bx, ry + 6, bz, 2, 'orange_terracotta');
    for (const [a, b] of [[-2, -1], [1, 2], [2, -2], [-1, 1]]) p.set(bx + a, ry + 6, bz + b, 'white_concrete'); // Sesam
    // Parkplatz vor dem Laden
    const f = c.f, px = x + f.dx * 12, pz = z + f.dz * 12;
    parking(p, Math.min(px, px) - (f.dz ? 14 : 3), Math.min(pz, pz) - (f.dx ? 14 : 3), px + (f.dz ? 14 : 3), pz + (f.dx ? 14 : 3));
  } else {
    // weitere Bauten: einfache, aber grosse Gebaeude mit eigenem Stil
    const S = {
      Einkaufszentrum: { w: 31, d: 25, floors: 3, wall: 'white_concrete', corner: 'light_blue_concrete', roof: 'light_gray_concrete', window: 'light_blue_stained_glass' },
      Krankenhaus: { w: 25, d: 21, floors: 5, wall: 'white_concrete', corner: 'red_concrete', roof: 'white_concrete', window: 'glass' },
      Feuerwehr: { w: 27, d: 19, floors: 2, wall: 'red_concrete', corner: 'white_concrete', roof: 'gray_concrete', window: 'glass' },
      Schule: { w: 29, d: 19, floors: 3, wall: 'bricks', corner: 'stone_bricks', roof: 'gray_concrete', window: 'glass' },
      Polizei: { w: 25, d: 19, floors: 3, wall: 'blue_concrete', corner: 'white_concrete', roof: 'gray_concrete', window: 'glass' },
    }[name] || { w: 25, d: 21, floors: 3, wall: 'quartz_bricks', corner: 'gold_block', roof: 'gray_concrete', window: 'glass' };
    ground(p, x, z);
    style(S);
  }
  return { layers: p.layers(), top: p.top ?? BASE + 20 };
}
