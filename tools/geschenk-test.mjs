// Zeigt die Geschenk-Effekte an einem Haus, ohne Punkte oder Coins zu vergeben.
// Aufruf: node tools/geschenk-test.mjs <tiktokname> heart donut sparkle ...
import fs from 'fs';
import { Minecraft, sleep } from '../src/minecraft.js';
import { Builder } from '../src/builder.js';
import { GiftFx } from '../src/giftfx.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const save = JSON.parse(fs.readFileSync(new URL('../data/save.json', import.meta.url)));
const [name, ...kinds] = process.argv.slice(2);
const p = save.players[name.toLowerCase()];
const mc = new Minecraft(cfg.rcon, (m) => { if (/Problem/.test(m)) console.log(m); });
const builder = new Builder(mc, cfg.minecraftName, () => {});
const fx = new GiftFx({ game: { store: { data: save, players: save.players } }, builder, speech: { say() {} }, broadcast() {} });
for (const k of kinds) { console.log('Effekt', k); await fx.effect(k, p, true); await sleep(2500); }
process.exit(0);
