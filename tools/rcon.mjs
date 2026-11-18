// Kleines Hilfsprogramm: node tools/rcon.mjs "befehl1" "befehl2"
import { Rcon } from 'rcon-client';
import fs from 'fs';
const c = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const r = await Rcon.connect(c.rcon);
for (const cmd of process.argv.slice(2)) console.log('>', cmd, '\n ', await r.send(cmd));
r.end();
