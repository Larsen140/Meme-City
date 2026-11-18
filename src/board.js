// Grosse Info-Tafel ueber dem Stadtplatz: wechselt zwischen "Chat-Befehle" und "So waechst dein Haus"
// und springt bei jedem Wechsel mit einer kleinen Animation auf. Nur Information, keine Aufforderung.
import { snbtString as q } from './minecraft.js';
import { BASE } from './city.js';

const Y = BASE + 17, SCALE = 2.4, TAG = 'mc_board';

const line = (key, rest, color = '#3DF5B0') => [`{text:${q(key)},color:${q(color)},bold:true}`, `{text:${q(rest + '\n')},color:"white"}`];
const comp = (title, titleColor, rows) => `{text:"",extra:[{text:${q(title + '\n')},color:${q(titleColor)},bold:true},${rows.flat().join(',')}]}`;

export const PAGES = [
  comp('CHAT-BEFEHLE', '#FFC93C', [
    line('Haus', '  eigenes Haus in Meme City'),
    line('zeig mein Haus', '  Kamera fliegt hin'),
    line('farbe rot', '  Dach neu streichen'),
    line('haustier drache', '  über 30 Tiere'),
    line('flagge deutschland', '  Fahne im Garten'),
    line('auto blau', '  Auto umlackieren'),
    line('party', '  Feier bei dir zu Hause'),
    line('nord / süd', '  Team fürs Duell'),
  ]),
  comp('SO WÄCHST DEIN HAUS', '#FF6FAE', [
    line('❤ 50 Likes', '  = 1 Punkt', '#FF6FAE'),
    line('★ Geschenke', '  1 Münze = 1 Punkt', '#FFC93C'),
    line('⌚ 5 Minuten dabei', '  = Haus wächst 1 Stufe', '#3DF5B0'),
    line('▶ 10.000 Likes', '  = eigenes Auto', '#4CC9FF'),
    line('■ Jeder Punkt', '  baut am Gemeinschaftsbau mit', '#FFC93C'),
  ]),
  // Nur Information: was ein Geschenk bewirkt (keine Aufforderung, keine Extra-Effekte)
  comp('GESCHENKE', '#FFC93C', [
    line('Rose', '  1 Münze = 1 Punkt', '#FF6FAE'),
    line('Fingerherz', '  5 Münzen = 5 Punkte', '#FF6FAE'),
    line('Donut', '  30 Münzen = 30 Punkte', '#FFC93C'),
    line('Jedes Geschenk', '  zählt fürs eigene Haus', '#3DF5B0'),
    line('Im Duell', '  1 Münze zählt wie 10 Likes', '#4CC9FF'),
    line('Und immer:', '  Likes und Chat zählen auch!', '#FFFFFF'),
  ]),
];
const BG = [-1072558032, -1070591936, -1070587904];

const tr = (s, rot = 0) => `transformation:{left_rotation:[0f,${Math.sin(rot / 2).toFixed(3)}f,0f,${Math.cos(rot / 2).toFixed(3)}f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[${s}f,${s}f,${s}f]}`;

export class Board {
  constructor(mc, log = console.log, everyMs = 15_000) {
    this.mc = mc; this.log = log; this.page = 0;
    this.start().catch((e) => log('[Tafel] ' + e.message));
    this.timer = setInterval(() => this.next().catch(() => {}), everyMs);
  }

  async start() {
    await this.mc.send(`kill @e[tag=${TAG}]`);
    await this.mc.send(`summon text_display 0 ${Y} 0 {Tags:["${TAG}"],billboard:"center",alignment:"left",background:-1072558032,shadow:1b,` +
      `line_width:400,brightness:{sky:15,block:15},view_range:6f,${tr(SCALE)},text:${PAGES[0]}}`);
  }

  /** Umblaettern: zusammenklappen, Text tauschen, wieder aufspringen */
  async next() {
    const sel = `@e[tag=${TAG},limit=1]`;
    this.page = (this.page + 1) % PAGES.length;
    await this.mc.send(`data merge entity ${sel} {start_interpolation:0,interpolation_duration:5,${tr(0.05)}}`);
    await new Promise((r) => setTimeout(r, 300));
    await this.mc.send(`data merge entity ${sel} {text:${PAGES[this.page]},background:${BG[this.page]}}`);
    await this.mc.send(`data merge entity ${sel} {start_interpolation:0,interpolation_duration:8,${tr(SCALE * 1.12)}}`);
    await new Promise((r) => setTimeout(r, 450));
    await this.mc.send(`data merge entity ${sel} {start_interpolation:0,interpolation_duration:6,${tr(SCALE)}}`);
  }
}
