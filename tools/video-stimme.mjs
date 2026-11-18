// Erzeugt die Sprecher-Saetze des Buergermeisters fuers TikTok-Video (MP3 je Satz) + Laengen.
import fs from 'fs';
import path from 'path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
const dir = path.resolve('data/video');
const cfg = JSON.parse(fs.readFileSync('config.json'));
export const SCRIPT = [
  { text: 'Willkommen in Meme City! Ich bin Bürgermeister Memo.', caption: 'Willkommen in MEME CITY! 🏙️' },
  { text: 'Hier bekommt jeder Zuschauer ein eigenes Haus. Schreib einfach Haus in den Chat!', caption: 'Schreib „Haus“ in den Chat 🏠' },
  { text: 'Mit jedem Like wächst dein Haus. Von der Hütte bis zum Hochhaus!', caption: 'Likes = dein Haus wächst ❤️' },
  { text: 'Färb dein Dach, hol dir ein Haustier und kämpf mit Team Nord gegen Team Süd!', caption: 'Farbe · Haustier · Nord vs. Süd ⚔️' },
  { text: 'Komm in den LIVE und zieh ein. Ich warte auf dich!', caption: 'Komm in den LIVE! 👇' },
];
const t = new MsEdgeTTS();
await t.setMetadata(cfg.voice || 'de-DE-ConradNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const out = [];
for (let i = 0; i < SCRIPT.length; i++) {
  const d = path.join(dir, 'satz' + i);
  fs.mkdirSync(d, { recursive: true });
  const r = await t.toFile(d, SCRIPT[i].text, { rate: '+8%', pitch: '-2Hz' });
  out.push({ ...SCRIPT[i], file: r.audioFilePath });
}
fs.writeFileSync(path.join(dir, 'skript.json'), JSON.stringify(out, null, 1));
console.log(out.map((o) => o.file).join('\n'));
t.close();
