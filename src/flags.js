// Flaggen im Garten: Fahnenmast in der hinteren Ecke des Grundstuecks ("flagge deutschland").
// Alles aus block_display-Teilen, aendert also keine Bloecke in der Welt.
import { plotCenter, frontOf, BASE } from './city.js';

const h = (...stripes) => ({ dir: 'h', stripes });
const v = (...stripes) => ({ dir: 'v', stripes });

export const FLAGS = {
  deutschland: ['Deutschland', h('black', 'red', 'yellow')],
  österreich: ['Österreich', h('red', 'white', 'red')], oesterreich: ['Österreich', h('red', 'white', 'red')],
  schweiz: ['Schweiz', { bg: 'red', cross: 'white' }],
  italien: ['Italien', v('green', 'white', 'red')],
  frankreich: ['Frankreich', v('blue', 'white', 'red')],
  spanien: ['Spanien', h('red', 'yellow', 'yellow', 'red')],
  portugal: ['Portugal', v('green', 'red', 'red')],
  polen: ['Polen', h('white', 'red')],
  niederlande: ['Niederlande', h('red', 'white', 'blue')], holland: ['Niederlande', h('red', 'white', 'blue')],
  belgien: ['Belgien', v('black', 'yellow', 'red')],
  irland: ['Irland', v('green', 'white', 'orange')],
  ukraine: ['Ukraine', h('blue', 'yellow')],
  kroatien: ['Kroatien', h('red', 'white', 'blue')],
  serbien: ['Serbien', h('red', 'blue', 'white')],
  rumänien: ['Rumänien', v('blue', 'yellow', 'red')], rumaenien: ['Rumänien', v('blue', 'yellow', 'red')],
  ungarn: ['Ungarn', h('red', 'white', 'green')],
  bulgarien: ['Bulgarien', h('white', 'green', 'red')],
  litauen: ['Litauen', h('yellow', 'green', 'red')],
  estland: ['Estland', h('blue', 'black', 'white')],
  griechenland: ['Griechenland', h('blue', 'white', 'blue', 'white', 'blue', 'white', 'blue', 'white', 'blue')],
  schweden: ['Schweden', { bg: 'blue', cross: 'yellow', nordic: true }],
  dänemark: ['Dänemark', { bg: 'red', cross: 'white', nordic: true }], daenemark: ['Dänemark', { bg: 'red', cross: 'white', nordic: true }],
  norwegen: ['Norwegen', { bg: 'red', cross: 'blue', nordic: true }],
  finnland: ['Finnland', { bg: 'white', cross: 'blue', nordic: true }],
  england: ['England', { bg: 'white', cross: 'red' }],
  türkei: ['Türkei', { bg: 'red', dot: 'white' }], tuerkei: ['Türkei', { bg: 'red', dot: 'white' }],
  albanien: ['Albanien', { bg: 'red', dot: 'black' }],
  japan: ['Japan', { bg: 'white', dot: 'red' }],
  brasilien: ['Brasilien', { bg: 'green', dot: 'yellow' }],
  marokko: ['Marokko', { bg: 'red', dot: 'green' }],
  tunesien: ['Tunesien', { bg: 'red', dot: 'white' }],
  argentinien: ['Argentinien', h('light_blue', 'white', 'light_blue')],
  nigeria: ['Nigeria', v('green', 'white', 'green')],
  usa: ['USA', { ...h('red', 'white', 'red', 'white', 'red', 'white', 'red'), canton: 'blue' }], amerika: ['USA', { ...h('red', 'white', 'red', 'white', 'red', 'white', 'red'), canton: 'blue' }],
  regenbogen: ['Regenbogen', h('red', 'orange', 'yellow', 'lime', 'blue', 'purple')], pride: ['Regenbogen', h('red', 'orange', 'yellow', 'lime', 'blue', 'purple')],
  piraten: ['Piraten', { bg: 'black', dot: 'white' }], pirat: ['Piraten', { bg: 'black', dot: 'white' }],
};

const W = 1.8, H = 1.1, Y0 = 3.6, T = 0.05; // Fahne: Breite, Hoehe, Unterkante, Dicke

/** Rechtecke [farbe, u0, v0, u1, v1, dicke] auf der Fahne (u = vom Mast weg, v = von unten) */
function rects(def) {
  const r = [];
  if (def.stripes) {
    const n = def.stripes.length;
    def.stripes.forEach((c, i) => {
      if (def.dir === 'h') r.push([c, 0, H - (i + 1) * H / n, W, H - i * H / n, T]);
      else r.push([c, i * W / n, 0, (i + 1) * W / n, H, T]);
    });
  } else r.push([def.bg, 0, 0, W, H, T]);
  if (def.canton) r.push([def.canton, 0, H / 2, W * 0.42, H, T + 0.02]);
  if (def.cross) {
    const cx = def.nordic ? W * 0.36 : W / 2, b = 0.18;
    r.push([def.cross, cx - b / 2, 0, cx + b / 2, H, T + 0.02]);
    r.push([def.cross, 0, H / 2 - b / 2, W, H / 2 + b / 2, T + 0.02]);
  }
  if (def.dot) { const s = 0.42; r.push([def.dot, W / 2 - s / 2, H / 2 - s / 2, W / 2 + s / 2, H / 2 + s / 2, T + 0.02]); }
  return r;
}

/** Mast in der vorderen Ecke des Vorgartens (zur Kamera hin), Fahne zeigt quer zur Strasse. */
export function flagSpot(p) {
  const { x: cx, z: cz } = plotCenter(p.plot);
  const f = frontOf(cx, cz);
  const back = (f.dx || f.dz) * 6 + 0.5; // Block 6 vorne (zwischen Hauswand und Hecke), Mitte des Blocks
  const side = -6 + 0.5;                  // linke Ecke
  return f.dx ? { x: cx + back, z: cz + side, lateral: 'z' } : { x: cx + side, z: cz + back, lateral: 'x' };
}

export function flagCommands(p, key) {
  const def = FLAGS[key][1];
  const { x, z, lateral } = flagSpot(p);
  const tag = `mc_flag_${p.plot}`;
  const n = (v) => Math.round(v * 1000) / 1000;
  const part = (block, tx, ty, tz, sx, sy, sz) =>
    `summon block_display ${x} ${BASE} ${z} {Tags:["mc_flag","${tag}"],block_state:"minecraft:${block}",` +
    `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${n(tx)}f,${n(ty)}f,${n(tz)}f],scale:[${n(sx)}f,${n(sy)}f,${n(sz)}f]}}`;
  const c = [`kill @e[tag=${tag}]`, part('white_concrete', -0.07, 0, -0.07, 0.14, Y0 + H + 0.25, 0.14), part('gold_block', -0.1, Y0 + H + 0.2, -0.1, 0.2, 0.2, 0.2)];
  for (const [col, u0, v0, u1, v1, t] of rects(def)) {
    const a = 0.07 + u0, w = u1 - u0;
    if (lateral === 'x') c.push(part(`${col}_concrete`, a, Y0 + v0, -t / 2, w, v1 - v0, t));
    else c.push(part(`${col}_concrete`, -t / 2, Y0 + v0, a, t, v1 - v0, w));
  }
  return c;
}
