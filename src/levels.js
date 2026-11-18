// Hausstufen: Name, Kosten bis zur nächsten Stufe (in Upgrade-Punkten) und Bau-Stil.
// w/d = Breite/Tiefe des Hauses (max. 11), floors = Stockwerke, roof = Dachform.

export const LEVELS = [
  { name: 'Starter-Hütte',   cost: 10,   w: 5,  d: 5,  floors: 1, wall: 'oak_planks',          corner: 'oak_log',              window: 'glass',                    roof: 'oak_planks',            roofType: 'pyramid' },
  { name: 'Holzhütte',       cost: 20,   w: 7,  d: 5,  floors: 1, wall: 'spruce_planks',       corner: 'spruce_log',           window: 'glass',                    roof: 'dark_oak_planks',       roofType: 'pyramid' },
  { name: 'Blockhaus',       cost: 35,   w: 7,  d: 7,  floors: 1, wall: 'stripped_spruce_log', corner: 'spruce_log',           window: 'glass',                    roof: 'spruce_planks',         roofType: 'pyramid' },
  { name: 'Steinhaus',       cost: 50,   w: 7,  d: 7,  floors: 1, wall: 'cobblestone',         corner: 'stone_bricks',         window: 'glass',                    roof: 'stone_bricks',          roofType: 'pyramid' },
  { name: 'Backsteinhaus',   cost: 75,   w: 9,  d: 7,  floors: 2, wall: 'bricks',              corner: 'stone_bricks',         window: 'glass',                    roof: 'deepslate_tiles',       roofType: 'pyramid' },
  { name: 'Fachwerkhaus',    cost: 100,  w: 9,  d: 7,  floors: 2, wall: 'white_terracotta',    corner: 'dark_oak_log',         window: 'glass',                    roof: 'red_nether_bricks',     roofType: 'pyramid' },
  { name: 'Bungalow',        cost: 150,  w: 11, d: 9,  floors: 1, wall: 'smooth_sandstone',    corner: 'sandstone',            window: 'light_blue_stained_glass', roof: 'smooth_stone_slab',     roofType: 'flat' },
  { name: 'Stadthaus',       cost: 200,  w: 9,  d: 9,  floors: 3, wall: 'light_gray_concrete', corner: 'gray_concrete',        window: 'glass',                    roof: 'smooth_stone_slab',     roofType: 'flat' },
  { name: 'Stadtvilla',      cost: 300,  w: 11, d: 9,  floors: 2, wall: 'white_concrete',      corner: 'quartz_pillar',        window: 'glass',                    roof: 'blue_terracotta',       roofType: 'pyramid' },
  { name: 'Landhaus',        cost: 400,  w: 11, d: 11, floors: 2, wall: 'stripped_birch_log',  corner: 'birch_log',            window: 'glass',                    roof: 'mud_bricks',            roofType: 'pyramid' },
  { name: 'Villa',           cost: 500,  w: 11, d: 11, floors: 3, wall: 'quartz_block',        corner: 'quartz_pillar',        window: 'light_blue_stained_glass', roof: 'cyan_terracotta',       roofType: 'pyramid' },
  { name: 'Herrenhaus',      cost: 700,  w: 11, d: 11, floors: 3, wall: 'polished_andesite',   corner: 'dark_oak_log',         window: 'glass',                    roof: 'deepslate_tiles',       roofType: 'pyramid' },
  { name: 'Luxusvilla',      cost: 900,  w: 11, d: 11, floors: 3, wall: 'white_concrete',      corner: 'gold_block',           window: 'light_blue_stained_glass', roof: 'smooth_quartz_slab',    roofType: 'flat' },
  { name: 'Apartmenthaus',   cost: 1200, w: 11, d: 11, floors: 5, wall: 'orange_terracotta',   corner: 'polished_blackstone',  window: 'glass',                    roof: 'smooth_stone_slab',     roofType: 'flat' },
  { name: 'Hotel',           cost: 1500, w: 11, d: 11, floors: 7, wall: 'terracotta',          corner: 'quartz_pillar',        window: 'yellow_stained_glass',     roof: 'smooth_quartz_slab',    roofType: 'flat' },
  { name: 'Hochhaus',        cost: 2000, w: 11, d: 11, floors: 9, wall: 'gray_concrete',       corner: 'black_concrete',       window: 'light_blue_stained_glass', roof: 'smooth_stone_slab',     roofType: 'flat' },
  { name: 'Wolkenkratzer',   cost: 2500, w: 11, d: 11, floors: 12, wall: 'cyan_stained_glass', corner: 'white_concrete',       window: 'light_blue_stained_glass', roof: 'smooth_quartz_slab',    roofType: 'flat' },
  { name: 'Burg',            cost: 3000, w: 11, d: 11, floors: 3, wall: 'stone_bricks',        corner: 'mossy_stone_bricks',   window: 'gray_stained_glass',                roof: 'stone_bricks',          roofType: 'castle' },
  { name: 'Schloss',         cost: 4000, w: 11, d: 11, floors: 4, wall: 'quartz_bricks',       corner: 'quartz_pillar',        window: 'light_blue_stained_glass', roof: 'blue_concrete',         roofType: 'castle' },
  { name: 'Königspalast',    cost: null, w: 11, d: 11, floors: 5, wall: 'gold_block',          corner: 'quartz_pillar',        window: 'yellow_stained_glass',     roof: 'purple_concrete',       roofType: 'castle' },
];

export const MAX_LEVEL = LEVELS.length;

/** Punkte, die man insgesamt braucht, um eine Stufe zu erreichen (Stufe 1 = 0). */
export function pointsForLevel(level) {
  let sum = 0;
  for (let i = 1; i < level; i++) sum += LEVELS[i - 1].cost;
  return sum;
}

export function levelForPoints(points) {
  let level = 1;
  while (level < MAX_LEVEL && points >= pointsForLevel(level + 1)) level++;
  return level;
}

export function levelInfo(level) {
  return LEVELS[Math.max(1, Math.min(MAX_LEVEL, level)) - 1];
}
