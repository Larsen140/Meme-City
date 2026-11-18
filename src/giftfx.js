// Geschenk-Effekte: jedes Geschenk sieht man in der Stadt – direkt am Haus des Schenkers.
// WICHTIG: Hier wird nur REAGIERT. Nichts in dieser Datei fordert zum Schenken auf.
import { BASE, plotCenter, frontOf } from './city.js';
import { sleep } from './minecraft.js';
import { signCommand } from './builder.js';

const T = (tx, ty, tz, sx, sy, sz) =>
  `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${tx}f,${ty}f,${tz}f],scale:[${sx}f,${sy}f,${sz}f]}`;

// Bekannte Geschenke (englische und deutsche Namen) -> Effekt
const GIFTS = [
  [/rose/i, 'rose'],
  [/^tiktok$|^gg$|ice cream|eis/i, 'sparkle'],
  [/finger heart|fingerherz|heart me|hand heart|herz/i, 'heart'],
  [/donut|doughnut/i, 'donut'],
  [/perfume|parfum|parfüm/i, 'perfume'],
  [/galaxy|galaxie/i, 'galaxy'],
  [/rocket|rakete/i, 'rocket'],
  [/lion|löwe|loewe|universe|universum|planet/i, 'mega'],
];

// Plaetze fuer Ehren-Statuen auf dem Stadtplatz
const STATUE_SPOTS = [[-11, 0], [11, 0], [0, -11], [0, 11]];

export class GiftFx {
  constructor({ game, builder, speech, broadcast, log = console.log }) {
    this.game = game; this.builder = builder; this.mc = builder.mc;
    this.speech = speech; this.broadcast = broadcast; this.log = log;
    this.sessionCoins = new Map();
    // Top-Unterstuetzer des Streams ab und zu zeigen (reine Info, keine Aufforderung)
    setTimeout(() => { this.supporters(); setInterval(() => this.supporters(), 60_000); }, 40_000);
  }

  supporters() {
    const top = [...this.sessionCoins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, coins]) => {
      const p = this.game.store.players[id];
      return { name: p?.name || id, avatar: p?.avatar || '', coins };
    });
    if (top.length) this.broadcast({ type: 'supporters', top });
  }

  houseSpot(p) {
    const { x, z } = plotCenter(p.plot);
    return { x, z, top: p.top ?? BASE + 10, fr: frontOf(x, z) };
  }

  /** Wird bei jedem Geschenk aufgerufen. */
  run(p, gift, coins) {
    this.sessionCoins.set(p.id, (this.sessionCoins.get(p.id) || 0) + coins);
    if ((gift.count || 1) >= 5) {
      this.broadcast({ type: 'banner', title: `🔥 COMBO x${gift.count}!`, text: `@${p.name} · ${gift.name}`, avatar: p.avatar, big: true });
    }
    this.checkCrown();
    if (coins >= 1000) this.statue(p);

    const kind = GIFTS.find(([re]) => re.test(gift.name || ''))?.[1]
      || (coins >= 1000 ? 'mega' : coins >= 100 ? 'heart' : coins >= 30 ? 'donut' : coins >= 5 ? 'sparkle' : 'rose');
    if (p.plot === null) return;

    // Kleine Geschenke: Effekt am Haus ohne Kameraflug (sonst springt die Kamera bei jeder Rose)
    if (coins < 5) return this.effect(kind, p);
    // Groessere: Kamera fliegt hin und dann der Effekt (nicht doppelt anstellen)
    if (this.builder.queue.some((j) => j.giftFor === p.id)) return;
    this.builder.enqueue({ type: 'camera', player: p, giftFor: p.id });
    this.builder.enqueue({ type: 'fn', giftFor: p.id, fn: () => this.effect(kind, p, true) });
  }

  async effect(kind, p, big = false) {
    const mc = this.mc, { x, z, top, fr } = this.houseSpot(p);
    const y = top + 3;
    if (kind === 'rose') {
      await mc.send(`particle minecraft:heart ${x} ${y} ${z} 2 1 2 0 8 force`);
      // eine Blume waechst im Garten
      const fx = x + Math.round((Math.random() - 0.5) * 10), fz = z + Math.round((Math.random() - 0.5) * 10);
      await mc.send(`setblock ${fx} ${BASE} ${fz} poppy keep`);
      await mc.send(`playsound minecraft:block.azalea.place master @a ${x} ${BASE} ${z} 1 1.4`);
    } else if (kind === 'sparkle') {
      await mc.send(`particle minecraft:note ${x} ${y} ${z} 3 1.5 3 1 25 force`);
      await mc.send(`particle minecraft:wax_on ${x} ${y} ${z} 3 2 3 0.5 60 force`);
      await mc.send(`playsound minecraft:block.note_block.chime master @a ${x} ${BASE} ${z} 2 1.5`);
    } else if (kind === 'heart') {
      await this.heartShape(x, y + 3, z, fr, big ? 3 : 2);
      await mc.send(`playsound minecraft:entity.player.levelup master @a ${x} ${BASE} ${z} 2 1.2`);
      if (big) await this.builder.fireworkShow(x, z, 4, 5);
    } else if (kind === 'donut') {
      await this.donut(x, y + 3, z);
      await this.builder.fireworkShow(x, z, 3, 5);
    } else if (kind === 'perfume') {
      await mc.send(`particle minecraft:cherry_leaves ${x} ${y + 2} ${z} 5 3 5 0 300 force`);
      await mc.send(`particle minecraft:spore_blossom_air ${x} ${y} ${z} 5 2 5 0 200 force`);
      await mc.send(`playsound minecraft:block.amethyst_block.chime master @a ${x} ${BASE} ${z} 2 1`);
    } else if (kind === 'rocket') {
      for (let i = 0; i < 6; i++) { await this.builder.firework(x, top + 1, z, true); await sleep(300); }
    } else if (kind === 'galaxy') {
      await mc.send('time set midnight');
      for (let a = 0; a < 360 * 3; a += 15) {
        const r = 2 + a / 160, rad = (a * Math.PI) / 180;
        await mc.send(`particle minecraft:end_rod ${(x + Math.cos(rad) * r).toFixed(1)} ${(y + a / 120).toFixed(1)} ${(z + Math.sin(rad) * r).toFixed(1)} 0 0 0 0 2 force`);
        if (a % 90 === 0) await sleep(60);
      }
      await this.builder.fireworkShow(x, z, 6, 6);
      setTimeout(() => mc.send('time set noon'), 9000);
    } else if (kind === 'mega') {
      await this.heartShape(x, y + 4, z, fr, 4);
      await this.builder.fireworkShow(x, z, 10, 8);
      await this.game.bigEvent(p);
    }
  }

  /** Grosses Herz aus roten Partikeln, zur Kamera hin ausgerichtet. */
  async heartShape(x, y, z, fr, size) {
    const s = size * 0.12;
    for (let k = 0; k < 3; k++) {
      let cmds = [];
      for (let t = 0; t < Math.PI * 2; t += 0.12) {
        const hx = 16 * Math.sin(t) ** 3 * s, hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s;
        const px = fr.dx ? x : x + hx, pz = fr.dx ? z + hx : z;
        cmds.push(`particle minecraft:dust{color:[1.0,0.15,0.35],scale:2.0} ${px.toFixed(2)} ${(y + hy).toFixed(2)} ${pz.toFixed(2)} 0 0 0 0 2 force`);
      }
      await this.mc.sendAll(cmds);
      await sleep(350);
    }
  }

  /** Riesiger Donut schwebt 10 Sekunden ueber dem Haus. */
  async donut(x, y, z) {
    const mc = this.mc, tag = `mc_donut_${Date.now()}`;
    for (let a = 0; a < 360; a += 30) {
      const rad = (a * Math.PI) / 180, cx = Math.cos(rad) * 2.2, cz = Math.sin(rad) * 2.2;
      await mc.send(`summon block_display ${(x + cx).toFixed(2)} ${y} ${(z + cz).toFixed(2)} {Tags:["${tag}"],block_state:"minecraft:brown_terracotta",${T(-0.6, 0, -0.6, 1.2, 0.8, 1.2)}}`);
      await mc.send(`summon block_display ${(x + cx).toFixed(2)} ${y} ${(z + cz).toFixed(2)} {Tags:["${tag}"],block_state:"minecraft:pink_concrete",${T(-0.62, 0.7, -0.62, 1.24, 0.25, 1.24)}}`);
    }
    await mc.send(`particle minecraft:dust{color:[1.0,0.9,0.2],scale:1.2} ${x} ${y + 1} ${z} 2 0.3 2 0 60 force`);
    await mc.send(`playsound minecraft:entity.generic.eat master @a ${x} ${y} ${z} 2 0.8`);
    setTimeout(() => mc.send(`kill @e[tag=${tag}]`), 10_000);
  }

  // ---------- Krone fuer den Ehrenbuergermeister ----------

  async checkCrown() {
    const ts = this.game.topSupporter();
    const data = this.game.store.data;
    if (!ts || ts.plot === null || data.crownFor === ts.id) return;
    const first = !data.crownFor;
    data.crownFor = ts.id;
    this.game.store.save();
    if (!first) {
      this.speech.say(`Machtwechsel! ${ts.nick || ts.name} ist der neue Ehrenbürgermeister und bekommt die goldene Krone!`, true);
      this.broadcast({ type: 'banner', title: '👑 NEUER EHRENBÜRGERMEISTER', text: `@${ts.name}`, avatar: ts.avatar, big: true });
    }
    this.builder.enqueue({ type: 'fn', fn: () => this.placeCrown(ts) });
  }

  async placeCrown(p) {
    const mc = this.mc, { x, z, top } = this.houseSpot(p);
    const y = top + 8;
    await mc.send('kill @e[tag=mc_crown]');
    await mc.send(`forceload add ${x - 2} ${z - 2} ${x + 2} ${z + 2}`);
    const parts = [
      ['gold_block', T(-1.2, 0, -1.2, 2.4, 0.6, 2.4)],
      ['gold_block', T(-1.2, 0.6, -1.2, 0.5, 0.8, 0.5)], ['gold_block', T(0.7, 0.6, -1.2, 0.5, 0.8, 0.5)],
      ['gold_block', T(-1.2, 0.6, 0.7, 0.5, 0.8, 0.5)], ['gold_block', T(0.7, 0.6, 0.7, 0.5, 0.8, 0.5)],
      ['redstone_block', T(-0.3, 0.15, -1.3, 0.6, 0.3, 0.1)], ['lapis_block', T(-1.3, 0.15, -0.3, 0.1, 0.3, 0.6)],
      ['emerald_block', T(-0.3, 0.15, 1.2, 0.6, 0.3, 0.1)], ['diamond_block', T(1.2, 0.15, -0.3, 0.1, 0.3, 0.6)],
    ];
    for (const [b, tr] of parts) {
      await mc.send(`summon block_display ${x} ${y} ${z} {Tags:["mc_crown"],brightness:{sky:15,block:15},block_state:"minecraft:${b}",${tr}}`);
    }
    await mc.send(`particle minecraft:totem_of_undying ${x} ${y} ${z} 1 1 1 0.4 120 force`);
    await mc.send(`forceload remove ${x - 2} ${z - 2} ${x + 2} ${z + 2}`);
  }

  // ---------- Ehren-Statue auf dem Stadtplatz ----------

  statue(p) {
    const data = this.game.store.data;
    data.statues = data.statues || [];
    if (data.statues.some((s) => s.id === p.id)) return; // jeder nur eine Statue
    const idx = data.statues.length < STATUE_SPOTS.length ? data.statues.length : (data.statueNext = ((data.statueNext || 0) + 1) % STATUE_SPOTS.length);
    data.statues[idx] = { id: p.id, name: p.name };
    this.game.store.save();
    const [sx, sz] = STATUE_SPOTS[idx];
    this.speech.say(`Zu Ehren von ${p.nick || p.name} bekommt Meme City ein Denkmal auf dem Stadtplatz!`, true);
    this.builder.enqueue({ type: 'fn', fn: async () => {
      const mc = this.mc;
      await this.builder.camera(sx + 9, BASE + 7, sz + 9, sx, BASE + 2, sz, 3);
      await mc.send(`fill ${sx - 1} ${BASE} ${sz - 1} ${sx + 1} ${BASE + 6} ${sz + 1} air`);
      await mc.send(`fill ${sx - 1} ${BASE} ${sz - 1} ${sx + 1} ${BASE} ${sz + 1} smooth_quartz`);
      await sleep(300);
      await mc.send(`setblock ${sx} ${BASE + 1} ${sz} chiseled_quartz_block`);
      await sleep(300);
      for (const [dy, b] of [[2, 'gold_block'], [3, 'gold_block'], [4, 'raw_gold_block']]) {
        await mc.send(`setblock ${sx} ${BASE + dy} ${sz} ${b}`);
        await mc.send(`particle minecraft:wax_on ${sx} ${BASE + dy} ${sz} 0.6 0.6 0.6 0.4 40 force`);
        await mc.send(`playsound minecraft:block.anvil.place master @a ${sx} ${BASE} ${sz} 1 ${1 + dy * 0.1}`);
        await sleep(400);
      }
      await mc.send(`kill @e[tag=mc_statue_${idx}]`);
      await mc.send(signCommand(sx, BASE + 6, sz, [`mc_statue_${idx}`], 2.2, `{text:"DENKMAL\\n",color:"#FFD84D",bold:true,extra:[{text:${JSON.stringify('@' + p.name)},color:"#FFFFFF",bold:true}]}`));
      await this.builder.fireworkShow(sx, sz, 6, 3);
      await sleep(1500);
    } });
  }
}
