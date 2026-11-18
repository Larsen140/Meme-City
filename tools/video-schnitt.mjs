// Schneidet das TikTok-Video: Minecraft-Flug + Buergermeister + Untertitel + Stimme + Musik.
import { execFileSync } from 'child_process';
import fs from 'fs';
const FF = process.argv[2];
const D = 'data/video';
const cut = JSON.parse(fs.readFileSync(`${D}/schnitt.json`));
const dur = [4.44, 5.664, 4.92, 5.04, 4.128];
const caps = ['Willkommen in MEME CITY!', 'Schreib „Haus“ in den Chat', 'Jedes Like = dein Haus wächst', 'Farbe, Haustier & Team-Duell', 'Komm in den LIVE!'];
const starts = []; let t = 0.3;
for (const d of dur) { starts.push(t); t += d + 0.4; }
const total = Math.min(cut.length, t + 0.6);
caps.forEach((c, i) => fs.writeFileSync(`${D}/cap${i}.txt`, c));
fs.writeFileSync(`${D}/top1.txt`, 'BAU DEIN HAUS IM LIVE');
fs.writeFileSync(`${D}/top2.txt`, 'Minecraft-Stadt zum Mitmachen');
const font = 'data/video/font.ttf'; // Kopie von Segoe UI Bold (Pfad ohne Doppelpunkt)
const talking = starts.map((s, i) => `between(t,${s.toFixed(2)},${(s + dur[i]).toFixed(2)})`).join('+');
let vf = `[0:v]trim=start=${cut.startOffset.toFixed(2)}:duration=${total.toFixed(2)},setpts=PTS-STARTPTS[v0];`;
vf += `[v0]drawbox=x=0:y=90:w=iw:h=230:color=0x1b1240@0.75:t=fill,` +
  `drawtext=fontfile=${font}:textfile=${D}/top1.txt:fontcolor=0xFFD84D:fontsize=86:x=(w-tw)/2:y=115:borderw=6:bordercolor=0x1b1240,` +
  `drawtext=fontfile=${font}:textfile=${D}/top2.txt:fontcolor=white:fontsize=50:x=(w-tw)/2:y=225[v1];`;
let last = 'v1';
caps.forEach((c, i) => {
  const s = starts[i], e = s + dur[i] + 0.35;
  vf += `[${last}]drawtext=fontfile=${font}:textfile=${D}/cap${i}.txt:fontcolor=white:fontsize=64:x=(w-tw)/2:y=1180:box=1:boxcolor=0xff3d7f@0.92:boxborderw=26:enable='between(t,${s.toFixed(2)},${e.toFixed(2)})'[c${i}];`;
  last = `c${i}`;
});
vf += `[1:v]scale=360:450:flags=neighbor[may];[${last}][may]overlay=x=30:y='H-h-150-(${talking})*abs(sin(t*9))*14'[v2];`;
vf += `[v2]drawtext=fontfile=${font}:text='Bürgermeister Memo':fontcolor=white:fontsize=40:x=60:y=H-150:box=1:boxcolor=0xff3d7f@0.95:boxborderw=12,` +
  `drawtext=fontfile=${font}:text='@memecitymc':fontcolor=white:fontsize=46:x=w-tw-50:y=H-140:borderw=4:bordercolor=0x1b1240[vout];`;
// Ton: Saetze mit Pausen + leise Musik
let af = '';
dur.forEach((d, i) => { af += `[${2 + i}:a]adelay=${Math.round(starts[i] * 1000)}|${Math.round(starts[i] * 1000)},volume=1.6[s${i}];`; });
af += `[7:a]atrim=duration=${total.toFixed(2)},volume=0.22,afade=t=out:st=${(total - 1.5).toFixed(2)}:d=1.5[mus];`;
af += `${dur.map((_, i) => `[s${i}]`).join('')}[mus]amix=inputs=${dur.length + 1}:normalize=0:duration=longest,atrim=duration=${total.toFixed(2)}[aout]`;
const args = ['-y', '-loglevel', 'error', '-i', `${D}/roh.mp4`, '-i', `${D}/buergermeister.png`];
for (let i = 0; i < 5; i++) args.push('-i', `${D}/satz${i}/audio.mp3`);
args.push('-i', 'assets/musik/meme-city.wav', '-filter_complex', vf + af, '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'branding/tiktok-video.mp4');
execFileSync(FF, args, { stdio: 'inherit' });
console.log('fertig, Länge', total.toFixed(1), 's');
