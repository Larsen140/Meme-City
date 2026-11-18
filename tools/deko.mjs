// Verschoenert den Stadtplatz und baut Deko-Gebaeude am Stadtrand (nur einmal ausfuehren).
// Aufruf: node tools/deko.mjs
import fs from 'fs';
import { Minecraft, sleep } from '../src/minecraft.js';
import { signCommand } from '../src/builder.js';

const G = -61, B = -60;
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon, (m) => { if (/Problem/.test(m)) console.log(m); });
const cmds = [];
const c = (s) => cmds.push(s);
const circle = (cx, cz, r, y, block, hollow = false) => {
  for (let dx = -r; dx <= r; dx++) {
    const w = Math.floor(Math.sqrt(r * r - dx * dx + 0.5));
    if (hollow) { c(`setblock ${cx + dx} ${y} ${cz - w} ${block}`); c(`setblock ${cx + dx} ${y} ${cz + w} ${block}`); }
    else c(`fill ${cx + dx} ${y} ${cz - w} ${cx + dx} ${y} ${cz + w} ${block}`);
  }
  if (hollow) for (let dz = -r; dz <= r; dz++) { const w = Math.floor(Math.sqrt(r * r - dz * dz + 0.5)); c(`setblock ${cx - w} ${y} ${cz + dz} ${block}`); c(`setblock ${cx + w} ${y} ${cz + dz} ${block}`); }
};

// ---------- 1. Stadtplatz ----------
// Wege-Kreuz zwischen den Gebaeuden: Muster aus hellem und dunklem Stein
for (const [x1, z1, x2, z2] of [[-12, -27, 12, -8], [-12, 8, 12, 27], [-27, -12, -8, 12], [8, -12, 27, 12]]) {
  c(`fill ${x1} ${G} ${z1} ${x2} ${G} ${z2} smooth_stone replace smooth_stone`);
  for (let x = x1; x <= x2; x += 2) c(`fill ${x} ${G} ${z1} ${x} ${G} ${z2} polished_andesite replace smooth_stone`);
}
// Mittelfeld: runder Platz mit Muster
c(`fill -7 ${G} -7 7 ${G} 7 polished_andesite`);
circle(0, 0, 7, G, 'smooth_quartz');
circle(0, 0, 5, G, 'polished_diorite');
circle(0, 0, 7, G, 'chiseled_stone_bricks', true);
// Grosser Brunnen mit drei Stufen
c(`fill -6 ${B} -6 6 ${B + 6} 6 air`);
circle(0, 0, 5, B, 'prismarine_bricks', true);
circle(0, 0, 4, B, 'water');
c(`fill -1 ${B} -1 1 ${B + 2} 1 quartz_bricks`);
circle(0, 0, 2, B + 3, 'prismarine_bricks');
circle(0, 0, 1, B + 3, 'water');
c(`fill 0 ${B + 3} 0 0 ${B + 5} 0 quartz_pillar`);
c(`setblock 0 ${B + 6} 0 sea_lantern`);
c(`setblock 0 ${B + 7} 0 water`);
// Blumenbeete mit Hecke an den vier Ecken des Mittelfelds
for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
  c(`fill ${x - 2} ${G} ${z - 2} ${x + 2} ${G} ${z + 2} grass_block`);
  c(`fill ${x - 2} ${B} ${z - 2} ${x + 2} ${B} ${z + 2} oak_leaves[persistent=true] hollow`);
  for (const [fx, fz, f] of [[-1, -1, 'red_tulip'], [1, -1, 'allium'], [-1, 1, 'cornflower'], [1, 1, 'oxeye_daisy'], [0, 1, 'pink_tulip'], [1, 0, 'blue_orchid']]) c(`setblock ${x + fx} ${B} ${z + fz} ${f} keep`);
}
// Laternen entlang der Wege
for (const p of [-24, -18, 18, 24]) {
  for (const [x, z] of [[-9, p], [9, p], [p, -9], [p, 9]]) {
    c(`fill ${x} ${B} ${z} ${x} ${B + 2} ${z} dark_oak_fence`);
    c(`setblock ${x} ${B + 3} ${z} lantern`);
  }
}
// Leere Gemeinschafts-Flaechen: Rasen mit Blumen, bis dort gebaut wird
for (const [x, z] of [[20, 0], [0, 20], [-20, 0], [-20, -20], [20, -20], [20, 20], [-20, 20]]) {
  c(`execute if block ${x} ${G} ${z} smooth_stone if block ${x} ${B} ${z} air run fill ${x - 6} ${G} ${z - 6} ${x + 6} ${G} ${z + 6} grass_block replace smooth_stone`);
}

// ---------- 2. Deko-Gebaeude am Stadtrand ----------
const clearArea = (x, z, r) => {
  c(`fill ${x - r} ${B} ${z - r} ${x + r} ${B + 30} ${z + r} air replace #minecraft:leaves`);
  c(`fill ${x - r} ${B} ${z - r} ${x + r} ${B + 30} ${z + r} air replace #minecraft:logs`);
  c(`fill ${x - r} ${G} ${z - r} ${x + r} ${G} ${z + r} grass_block`);
};

// Windmuehle (Norden)
{
  const x = 0, z = -150; clearArea(x, z, 9);
  for (let y = 0; y < 14; y++) circle(x, z, 3 - (y > 9 ? 1 : 0), B + y, y % 4 === 3 ? 'stripped_spruce_log' : 'white_terracotta', true);
  for (let y = 14; y < 19; y++) circle(x, z, Math.max(0, 3 - (y - 14)), B + y, 'dark_oak_planks');
  c(`setblock ${x} ${B} ${z + 3} oak_door[half=lower,facing=south]`); c(`setblock ${x} ${B + 1} ${z + 3} oak_door[half=upper,facing=south]`);
  // Fluegel zur Stadt (Sueden)
  c(`fill ${x} ${B + 3} ${z + 4} ${x} ${B + 21} ${z + 4} spruce_fence`);
  c(`fill ${x - 9} ${B + 12} ${z + 4} ${x + 9} ${B + 12} ${z + 4} spruce_fence`);
  c(`fill ${x - 9} ${B + 13} ${z + 4} ${x - 2} ${B + 14} ${z + 4} white_wool`);
  c(`fill ${x + 2} ${B + 10} ${z + 4} ${x + 9} ${B + 11} ${z + 4} white_wool`);
  c(`fill ${x - 1} ${B + 14} ${z + 4} ${x} ${B + 21} ${z + 4} white_wool`);
  c(`fill ${x} ${B + 3} ${z + 4} ${x + 1} ${B + 10} ${z + 4} white_wool`);
  c(`setblock ${x} ${B + 12} ${z + 4} oak_log`);
}
// Kirche (Westen)
{
  const x = -150, z = -40; clearArea(x, z, 13);
  c(`fill ${x - 4} ${B} ${z - 8} ${x + 4} ${B + 7} ${z + 8} white_concrete hollow`);
  for (let i = 0; i <= 5; i++) c(`fill ${x - 5 + i} ${B + 8 + i} ${z - 9} ${x + 5 - i} ${B + 8 + i} ${z + 9} deepslate_tiles`);
  for (const zz of [z - 5, z - 1, z + 3]) { c(`fill ${x - 4} ${B + 2} ${zz} ${x - 4} ${B + 5} ${zz + 1} light_blue_stained_glass`); c(`fill ${x + 4} ${B + 2} ${zz} ${x + 4} ${B + 5} ${zz + 1} yellow_stained_glass`); }
  c(`fill ${x - 3} ${B} ${z + 9} ${x + 3} ${B + 20} ${z + 13} stone_bricks hollow`);
  for (let i = 0; i < 6; i++) c(`fill ${x - 3 + Math.ceil(i / 2)} ${B + 21 + i} ${z + 9 + Math.ceil(i / 2)} ${x + 3 - Math.ceil(i / 2)} ${B + 21 + i} ${z + 13 - Math.ceil(i / 2)} deepslate_tiles`);
  c(`fill ${x} ${B + 27} ${z + 11} ${x} ${B + 29} ${z + 11} gold_block`);
  c(`fill ${x - 1} ${B + 28} ${z + 11} ${x + 1} ${B + 28} ${z + 11} gold_block`);
  c(`fill ${x} ${B + 14} ${z + 13} ${x} ${B + 16} ${z + 13} glass`);
  c(`setblock ${x} ${B + 15} ${z + 14} bell[attachment=single_wall,facing=south]`);
  c(`fill ${x - 1} ${B} ${z + 13} ${x + 1} ${B + 2} ${z + 13} air`);
}
// Wasserturm (Osten)
{
  const x = 150, z = -40; clearArea(x, z, 9);
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) c(`fill ${x + dx} ${B} ${z + dz} ${x + dx} ${B + 14} ${z + dz} iron_block`);
  c(`fill ${x - 4} ${B + 7} ${z - 4} ${x + 4} ${B + 7} ${z + 4} iron_bars hollow`);
  for (let y = 15; y < 23; y++) circle(x, z, 6, B + y, y === 15 || y === 22 ? 'light_gray_concrete' : 'light_blue_concrete', y > 15 && y < 22);
  for (let y = 23; y < 26; y++) circle(x, z, 5 - (y - 23) * 2, B + y, 'light_gray_concrete');
  c(signCommand(x, B + 27, z, ['mc_deko_turm'], 4, '{text:"MEME CITY",color:"#FFC93C",bold:true}'));
}
// Kleiner Hafen-Leuchtturm am Teich? -> stattdessen Burgruine auf dem Huegel im Sueden
{
  const x = 0, z = 155; clearArea(x, z, 10);
  for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) for (let y = 0; y < 12; y++) circle(x + dx, z + dz, 2, B + y, y % 3 === 0 ? 'mossy_stone_bricks' : 'stone_bricks', true);
  c(`fill ${x - 7} ${B} ${z - 7} ${x + 7} ${B + 7} ${z - 7} stone_bricks`); c(`fill ${x - 7} ${B} ${z + 7} ${x + 7} ${B + 7} ${z + 7} cracked_stone_bricks`);
  c(`fill ${x - 7} ${B} ${z - 7} ${x - 7} ${B + 7} ${z + 7} mossy_stone_bricks`); c(`fill ${x + 7} ${B} ${z - 7} ${x + 7} ${B + 7} ${z + 7} stone_bricks`);
  c(`fill ${x - 2} ${B} ${z - 7} ${x + 2} ${B + 4} ${z - 7} air`);
  for (let i = -7; i <= 7; i += 2) { c(`setblock ${x + i} ${B + 8} ${z - 7} stone_bricks`); c(`setblock ${x + i} ${B + 8} ${z + 7} stone_bricks`); }
  c(`fill ${x} ${B} ${z} ${x} ${B + 10} ${z} dark_oak_fence`);
  c(`fill ${x + 1} ${B + 8} ${z} ${x + 3} ${B + 10} ${z} red_wool`);
}

// ---------- Ausfuehren (Bereiche laden) ----------
const areas = [[-30, -30, 30, 30], [-12, -165, 12, -138], [-165, -55, -135, -25], [138, -52, 162, -28], [-12, 140, 12, 168]];
for (const [x1, z1, x2, z2] of areas) await mc.send(`forceload add ${x1} ${z1} ${x2} ${z2}`);
await sleep(1500);
let n = 0;
for (const cmd of cmds) { await mc.send(cmd); if (++n % 60 === 0) await sleep(40); }
for (const [x1, z1, x2, z2] of areas.slice(1)) await mc.send(`forceload remove ${x1} ${z1} ${x2} ${z2}`);
await mc.send('kill @e[type=item]');
console.log(`Fertig: ${cmds.length} Befehle`);
process.exit(0);
