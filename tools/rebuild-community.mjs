// Einen Gemeinschaftsbau neu bauen: node tools/rebuild-community.mjs <index> <name>
import fs from 'fs';
import { Minecraft } from '../src/minecraft.js';
import { Builder } from '../src/builder.js';
const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const mc = new Minecraft(cfg.rcon);
const b = new Builder(mc, cfg.minecraftName);
await b.buildCommunity(Number(process.argv[2]), process.argv[3]);
process.exit(0);
