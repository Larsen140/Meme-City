// Geschenk-Effekte: jedes Geschenk sieht man in der Stadt – direkt am Haus des Schenkers.
// WICHTIG: Hier wird nur REAGIERT. Nichts in dieser Datei fordert zum Schenken auf.
import { BASE, plotCenter, frontOf } from './city.js';
import { sleep } from './minecraft.js';
import { signCommand } from './builder.js';

const T = (tx, ty, tz, sx, sy, sz) =>
  `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${tx}f,${ty}f,${tz}f],scale:[${sx}f,${sy}f,${sz}f]}`;

// Bekannte Geschenke (englische und deutsche Namen) -> Effekt
const GIFTS = [
  // eigene Effekte fuer viele beliebte Geschenke (spezielle zuerst)
  [/corgi|\bdog\b|hund|puppy|welpe/i, 'dog'],
  [/panda/i, 'panda'],
  [/\bcat\b|kitty|katze/i, 'cat'],
  [/money|geld|dollar|cash/i, 'money'],
  [/diamond|diamant/i, 'diamond'],
  [/train|\bzug\b|\blok\b/i, 'train'],
  [/sports car|\bcar\b|\bauto\b|motorcycle|motorrad/i, 'car'],
  [/\bjet\b|plane|flugzeug/i, 'plane'],
  [/sunglasses|sonnenbrille|disco/i, 'disco'],
  [/swan|schwan|\bbird|vogel|dove|taube/i, 'birds'],
  [/butterfly|schmetterling/i, 'butterfly'],
  [/confetti|konfetti/i, 'confetti'],
  [/firework|feuerwerk/i, 'rocket'],
  [/\bfire\b|feuer|flame/i, 'fire'],
  [/cake|kuchen|birthday/i, 'cake'],
  [/\bhat\b|top hat|\bhut\b|\bcap\b|mütze|mustache/i, 'hat'],
  [/\bmic\b|microphone|mikro/i, 'mic'],
  [/rainbow|regenbogen/i, 'rainbow'],
  [/crown|krone/i, 'minicrown'],
  [/whale|\bwal\b|dolphin|delfin/i, 'whale'],
  [/dragon|drache/i, 'dragon'],
  [/snow|schnee/i, 'snow'],
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

  /** Kurze Beschreibung, was ein Geschenk ausgeloest hat (fuer das Danke-Banner). */
  describe(gift, coins) {
    const kind = GIFTS.find(([re]) => re.test(gift.name || ''))?.[1]
      || (coins >= 1000 ? 'mega' : coins >= 100 ? 'heart' : coins >= 30 ? 'donut' : coins >= 5 ? 'sparkle' : 'rose');
    const text = { dog: 'Hund im Garten 🐶', panda: 'Panda im Garten 🐼', cat: 'Katze im Garten 🐱', money: 'Goldregen 💰', diamond: 'Diamantregen 💎', train: 'Zug fährt vorbei 🚂', car: 'Goldauto 🚗', plane: 'Flugzeug 🛩️', disco: 'Disco 🪩', birds: 'Vögel 🕊️', butterfly: 'Schmetterlinge 🦋', confetti: 'Konfetti 🎊', fire: 'Feuerzauber 🔥', cake: 'Torte 🎂', hat: 'Riesenhut 🎩', mic: 'Musik 🎤', rainbow: 'Regenbogen 🌈', minicrown: 'Goldglanz 👑', whale: 'Wasserfontäne 🐳', dragon: 'Drachenatem 🐉', snow: 'Schneemann ⛄', rose: 'Blume im Garten 🌹', sparkle: 'Funkeln am Haus ✨', heart: 'Riesen-Herz überm Haus ❤️', donut: 'Riesen-Donut 🍩',
      perfume: 'Blütenregen 🌸', rocket: 'Raketen vom Dach 🚀', galaxy: 'Sternennacht 🌌', mega: 'PARTY in Meme City 🎉' }[kind];
    return coins >= 1000 ? `${text} + Denkmal 🗿` : text;
  }

  /** Wird bei jedem Geschenk aufgerufen. */
  run(p, gift, coins) {
    this.sessionCoins.set(p.id, (this.sessionCoins.get(p.id) || 0) + coins);
    this.checkCrown();
    if (coins >= 1000) this.statue(p);

    const kind = GIFTS.find(([re]) => re.test(gift.name || ''))?.[1]
      || (coins >= 1000 ? 'mega' : coins >= 100 ? 'heart' : coins >= 30 ? 'donut' : coins >= 5 ? 'sparkle' : 'rose');
    if (p.plot === null) return;

    // Jedes Geschenk soll man sehen: Kamera fliegt zum Haus, dann der Effekt.
    // Schickt dieselbe Person schnell mehrere, wird nur einmal hingeflogen.
    if (this.builder.queue.some((j) => j.giftFor === p.id)) return;
    // Bei sehr vielen Auftraegen gleichzeitig kleine Geschenke ohne Flug zeigen
    if (coins < 5 && this.builder.queue.length > 4) return this.effect(kind, p);
    // Tiere bekommen eine eigene Nahaufnahme, alle anderen den Blick aufs Haus
    if (!['dog', 'panda', 'cat'].includes(kind)) this.builder.enqueue({ type: 'camera', player: p, giftFor: p.id });
    this.builder.enqueue({ type: 'fn', giftFor: p.id, fn: () => this.effect(kind, p, true) });
  }

  async effect(kind, p, big = false) {
    const mc = this.mc, { x, z, top, fr } = this.houseSpot(p);
    const y = top + 3;
    if (kind === 'rose') {
      // Herzen-Fontaene ueber dem Haus und neue Rosen im Garten
      for (let i = 0; i < 4; i++) {
        await mc.send(`particle minecraft:heart ${x} ${y + i} ${z} 2.5 0.8 2.5 0 14 force`);
        await mc.send(`particle minecraft:dust{color:[1.0,0.1,0.25],scale:1.6} ${x} ${y + i} ${z} 2 1 2 0 40 force`);
        await sleep(220);
      }
      for (let i = 0; i < 3; i++) {
        const fx = x + Math.round((Math.random() - 0.5) * 10), fz = z + Math.round((Math.random() - 0.5) * 10);
        await mc.send(`setblock ${fx} ${BASE} ${fz} poppy keep`);
        await mc.send(`particle minecraft:happy_villager ${fx} ${BASE + 0.5} ${fz} 0.3 0.3 0.3 0 6 force`);
      }
      await mc.send(`playsound minecraft:entity.experience_orb.pickup master @a ${x} ${BASE} ${z} 2 1.2`);
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
    } else if (kind === 'dog' || kind === 'panda' || kind === 'cat') {
      const [mob, label] = { dog: ['wolf', 'Hund'], panda: ['panda', 'Panda'], cat: ['cat', 'Katze'] }[kind];
      // im Vorgarten auf der anderen Wegseite als das Chat-Haustier, bleibt stehen
      const px = x + fr.dx * 5 - (fr.dz ? 3 : 0), pz = z + fr.dz * 5 - (fr.dx ? 3 : 0);
      const yaw = { north: 180, south: 0, east: -90, west: 90 }[fr.facing];
      if (big) await this.builder.petCamera(px, pz, fr);
      await mc.send(`kill @e[tag=mc_gift_pet_${p.plot}]`);
      p.giftPet = mob; this.game.store.save(); this.game.pushState?.();
      await mc.send(`summon ${mob} ${px} ${BASE} ${pz} {Tags:["mc_pet","mc_gift_pet_${p.plot}"],PersistenceRequired:1b,NoAI:1b,Invulnerable:1b,Rotation:[${yaw}f,0f],CustomName:${JSON.stringify(p.name + 's ' + label)},CustomNameVisible:1b}`);
      await mc.send(`particle minecraft:heart ${px} ${BASE + 1.5} ${pz} 1 0.6 1 0 20 force`);
      await mc.send(`particle minecraft:poof ${px} ${BASE + 0.5} ${pz} 0.5 0.3 0.5 0.05 30 force`);
      await mc.send(`playsound minecraft:entity.${mob}.ambient master @a ${px} ${BASE} ${pz} 2 1`);
      if (big) await sleep(4000);
    } else if (kind === 'money' || kind === 'diamond') {
      const item = kind === 'money' ? 'gold_ingot' : 'diamond';
      for (let i = 0; i < 12; i++) {
        await mc.send(`particle minecraft:item{item:"minecraft:${item}"} ${x} ${y + 6} ${z} 3 0.5 3 0.05 25 force`);
        if (i % 3 === 0) await mc.send(`playsound minecraft:entity.experience_orb.pickup master @a ${x} ${BASE} ${z} 1.5 ${1 + i * 0.05}`);
        await sleep(200);
      }
    } else if (kind === 'train' || kind === 'car') {
      await this.vehicle(x, z, fr, kind);
    } else if (kind === 'plane') {
      await this.plane(x, top, z, fr);
    } else if (kind === 'disco') {
      const cols = ['1.0,0.2,0.2', '0.2,1.0,0.3', '0.3,0.4,1.0', '1.0,0.9,0.2', '1.0,0.3,1.0', '0.2,1.0,1.0'];
      for (let i = 0; i < 16; i++) {
        await mc.send(`particle minecraft:dust{color:[${cols[i % cols.length]}],scale:2.5} ${x} ${y} ${z} 4 2.5 4 0 70 force`);
        if (i % 2 === 0) await mc.send(`playsound minecraft:block.note_block.bass master @a ${x} ${BASE} ${z} 1.5 ${[0.6, 0.8, 1, 0.8][i % 4]}`);
        await sleep(220);
      }
    } else if (kind === 'birds') {
      const tag = `mc_gift_birds_${Date.now()}`;
      for (let i = 0; i < 4; i++) await mc.send(`summon parrot ${x + i - 2} ${y + 2} ${z} {Tags:["${tag}","mc_gift_tmp"],Variant:${i % 5},PersistenceRequired:1b}`);
      await mc.send(`particle minecraft:cloud ${x} ${y + 2} ${z} 2 1 2 0.02 40 force`);
      await mc.send(`playsound minecraft:entity.parrot.fly master @a ${x} ${BASE} ${z} 2 1`);
      setTimeout(() => mc.send(`kill @e[tag=${tag}]`), 30_000);
    } else if (kind === 'butterfly' || kind === 'confetti') {
      const cols = ['1.0,0.4,0.7', '0.4,0.8,1.0', '1.0,0.85,0.2', '0.6,1.0,0.4', '0.8,0.5,1.0'];
      for (let i = 0; i < 10; i++) {
        for (const c of cols) await mc.send(`particle minecraft:dust{color:[${c}],scale:${kind === 'butterfly' ? 1.4 : 1.8}} ${x} ${y + 3} ${z} 4 2 4 0 ${kind === 'butterfly' ? 12 : 30} force`);
        await sleep(200);
      }
      await mc.send(`playsound minecraft:block.amethyst_block.chime master @a ${x} ${BASE} ${z} 2 1.3`);
    } else if (kind === 'fire') {
      for (let i = 0; i < 10; i++) {
        await mc.send(`particle minecraft:flame ${x} ${top + 1} ${z} 2 1.5 2 0.04 60 force`);
        await mc.send(`particle minecraft:lava ${x} ${top + 1} ${z} 2 0.5 2 0 6 force`);
        await sleep(200);
      }
      await mc.send(`playsound minecraft:item.firecharge.use master @a ${x} ${BASE} ${z} 2 0.9`);
    } else if (kind === 'cake') {
      const fx = x + (fr.dz ? 3 : 0) + fr.dx * 4, fz = z + (fr.dx ? 3 : 0) + fr.dz * 4;
      await mc.send(`setblock ${fx} ${BASE} ${fz} candle_cake[lit=true]`);
      await mc.send(`particle minecraft:wax_on ${fx} ${BASE + 1} ${fz} 0.5 0.5 0.5 0.2 40 force`);
      await this.builder.fireworkShow(x, z, 3, 4);
      await mc.send(`playsound minecraft:entity.player.levelup master @a ${x} ${BASE} ${z} 2 1.5`);
    } else if (kind === 'hat') {
      const tag = `mc_gift_hat_${Date.now()}`;
      await mc.send(`summon block_display ${x} ${top + 1} ${z} {Tags:["${tag}","mc_gift_tmp"],block_state:"minecraft:black_concrete",${T(-2.5, 0, -2.5, 5, 0.6, 5)}}`);
      await mc.send(`summon block_display ${x} ${top + 1} ${z} {Tags:["${tag}","mc_gift_tmp"],block_state:"minecraft:black_concrete",${T(-1.5, 0.6, -1.5, 3, 3.5, 3)}}`);
      await mc.send(`summon block_display ${x} ${top + 1} ${z} {Tags:["${tag}","mc_gift_tmp"],block_state:"minecraft:red_concrete",${T(-1.55, 0.7, -1.55, 3.1, 0.6, 3.1)}}`);
      await mc.send(`particle minecraft:poof ${x} ${top + 3} ${z} 2 1 2 0.05 40 force`);
      await mc.send(`playsound minecraft:entity.villager.celebrate master @a ${x} ${BASE} ${z} 2 1`);
      setTimeout(() => mc.send(`kill @e[tag=${tag}]`), 30_000);
    } else if (kind === 'mic') {
      for (let i = 0; i < 8; i++) {
        await mc.send(`particle minecraft:note ${x} ${y + 2} ${z} 3 2 3 1 20 force`);
        await mc.send(`playsound minecraft:block.note_block.pling master @a ${x} ${BASE} ${z} 1.5 ${[0.8, 1, 1.2, 1.5][i % 4]}`);
        await sleep(250);
      }
    } else if (kind === 'rainbow') {
      const cols = ['red', 'orange', 'yellow', 'lime', 'light_blue', 'purple'], tag = `mc_gift_rb_${Date.now()}`;
      for (let k = 0; k < cols.length; k++) {
        const r = 9 - k * 0.7;
        for (let a = 0; a <= 180; a += 12) {
          const rad = (a * Math.PI) / 180, ox = Math.cos(rad) * r, oy = Math.sin(rad) * r;
          const px = fr.dx ? x : x + ox, pz = fr.dx ? z + ox : z;
          await mc.send(`summon block_display ${px.toFixed(2)} ${(top + oy).toFixed(2)} ${pz.toFixed(2)} {Tags:["${tag}","mc_gift_tmp"],brightness:{sky:15,block:15},block_state:"minecraft:${cols[k]}_stained_glass",${T(-0.4, -0.4, -0.4, 0.8, 0.8, 0.8)}}`);
        }
      }
      await mc.send(`playsound minecraft:block.amethyst_block.chime master @a ${x} ${BASE} ${z} 2 1`);
      setTimeout(() => mc.send(`kill @e[tag=${tag}]`), 25_000);
    } else if (kind === 'minicrown') {
      await mc.send(`particle minecraft:totem_of_undying ${x} ${y + 2} ${z} 2 2 2 0.5 200 force`);
      await mc.send(`particle minecraft:item{item:"minecraft:gold_ingot"} ${x} ${y + 4} ${z} 2 0.5 2 0.05 40 force`);
      await mc.send(`playsound minecraft:ui.toast.challenge_complete master @a ${x} ${BASE} ${z} 2 1`);
    } else if (kind === 'whale') {
      for (let i = 0; i < 8; i++) {
        await mc.send(`particle minecraft:splash ${x} ${y + 3} ${z} 3 2 3 0.5 200 force`);
        await mc.send(`particle minecraft:bubble_pop ${x} ${y + 1} ${z} 3 1 3 0.1 60 force`);
        await sleep(200);
      }
      await mc.send(`playsound minecraft:entity.generic.splash master @a ${x} ${BASE} ${z} 2 0.6`);
    } else if (kind === 'dragon') {
      for (let i = 0; i < 10; i++) {
        await mc.send(`particle minecraft:dragon_breath ${x} ${y + 2} ${z} 3 2 3 0.05 120 force`);
        await sleep(200);
      }
      await mc.send(`playsound minecraft:entity.ender_dragon.growl master @a ${x} ${BASE} ${z} 1.5 1`);
      await this.builder.fireworkShow(x, z, 4, 5);
    } else if (kind === 'snow') {
      const tag = `mc_gift_snow_${Date.now()}`;
      // Schneemann aus Bloecken (echte Schneegolems schmelzen in dieser Welt)
      for (const [b, tr] of [['snow_block', T(-0.6, 0, -0.6, 1.2, 1.2, 1.2)], ['snow_block', T(-0.45, 1.2, -0.45, 0.9, 0.9, 0.9)], ['carved_pumpkin', T(-0.35, 2.1, -0.35, 0.7, 0.7, 0.7)]]) {
        await mc.send(`summon block_display ${x + 3} ${BASE} ${z + 3} {Tags:["${tag}","mc_gift_tmp"],block_state:"minecraft:${b}",${tr}}`);
      }
      for (let i = 0; i < 10; i++) { await mc.send(`particle minecraft:snowflake ${x} ${y + 4} ${z} 4 2 4 0.02 120 force`); await sleep(200); }
      setTimeout(() => mc.send(`kill @e[tag=${tag}]`), 40_000);
    } else if (kind === 'mega') {
      await this.heartShape(x, y + 4, z, fr, 4);
      await this.builder.fireworkShow(x, z, 10, 8);
      await this.game.bigEvent(p);
    }
  }

  /** Zug oder goldenes Auto faehrt auf der Strasse vor dem Haus vorbei. */
  async vehicle(x, z, fr, kind) {
    const mc = this.mc, tag = `mc_gift_veh_${Date.now()}`;
    const rx = x + fr.dx * 10 + 0.5, rz = z + fr.dz * 10 + 0.5;   // Strasse vor dem Haus
    const along = fr.dx ? { x: 0, z: 1 } : { x: 1, z: 0 };       // Fahrtrichtung quer dazu
    const yaw = fr.dx ? 0 : -90;
    const parts = kind === 'train'
      ? [[0, 'red_concrete', 1.6, 1.6, 3, 0.2], [0, 'black_concrete', 1.2, 0.8, 0.8, 1.8], [-3.6, 'blue_concrete', 1.6, 1.4, 3, 0.2], [-7.2, 'yellow_concrete', 1.6, 1.4, 3, 0.2], [-10.8, 'lime_concrete', 1.6, 1.4, 3, 0.2]]
      : [[0, 'gold_block', 1.7, 0.7, 3.4, 0.2], [0, 'light_blue_stained_glass', 1.4, 0.6, 1.6, 0.9]];
    const sx = rx - along.x * 22, sz = rz - along.z * 22;
    for (const [off, b, w, h, l, ty] of parts) {
      const ox = sx + along.x * off, oz = sz + along.z * off;
      await mc.send(`summon block_display ${ox.toFixed(2)} ${BASE} ${oz.toFixed(2)} {Tags:["${tag}","mc_gift_tmp"],teleport_duration:50,Rotation:[${yaw}f,0f],block_state:"minecraft:${b}",${T(-w / 2, ty, -l / 2, w, h, l)}}`);
    }
    await mc.send(`playsound minecraft:entity.minecart.riding master @a ${rx} ${BASE} ${rz} 2 ${kind === 'train' ? 0.7 : 1.4}`);
    await sleep(150);
    for (let k = 0; k < 2; k++) {
      await mc.send(`execute as @e[tag=${tag}] at @s run tp @s ~${along.x * 22} ~ ~${along.z * 22}`);
      if (kind === 'train') await mc.send(`particle minecraft:large_smoke ${(rx + along.x * (k * 22 - 11)).toFixed(1)} ${BASE + 4} ${(rz + along.z * (k * 22 - 11)).toFixed(1)} 0.5 0.5 0.5 0.02 30 force`);
      await sleep(2600);
    }
    await mc.send(`kill @e[tag=${tag}]`);
  }

  /** Flugzeug fliegt ueber das Haus. */
  async plane(x, top, z, fr) {
    const mc = this.mc, tag = `mc_gift_plane_${Date.now()}`, y = top + 10;
    const along = fr.dx ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const yaw = fr.dx ? 0 : -90;
    const sx = x - along.x * 40, sz = z - along.z * 40;
    const parts = [
      ['white_concrete', T(-0.8, 0, -4, 1.6, 1.6, 8)], ['white_concrete', T(-6, 0.6, -0.8, 12, 0.3, 1.8)],
      ['white_concrete', T(-2.5, 0.6, -4, 5, 0.3, 1)], ['red_concrete', T(-0.15, 1.6, -4, 0.3, 1.8, 1.2)],
      ['light_blue_stained_glass', T(-0.6, 1.2, 2.6, 1.2, 0.5, 1)],
    ];
    for (const [b, tr] of parts) await mc.send(`summon block_display ${sx} ${y} ${sz} {Tags:["${tag}","mc_gift_tmp"],teleport_duration:50,Rotation:[${yaw}f,0f],block_state:"minecraft:${b}",${tr}}`);
    await sleep(150);
    for (let k = 0; k < 2; k++) {
      await mc.send(`execute as @e[tag=${tag}] at @s run tp @s ~${along.x * 40} ~ ~${along.z * 40}`);
      await sleep(2600);
    }
    await mc.send(`kill @e[tag=${tag}]`);
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
      await mc.send(`summon block_display ${(x + cx).toFixed(2)} ${y} ${(z + cz).toFixed(2)} {Tags:["${tag}","mc_gift_tmp"],block_state:"minecraft:brown_terracotta",${T(-0.6, 0, -0.6, 1.2, 0.8, 1.2)}}`);
      await mc.send(`summon block_display ${(x + cx).toFixed(2)} ${y} ${(z + cz).toFixed(2)} {Tags:["${tag}","mc_gift_tmp"],block_state:"minecraft:pink_concrete",${T(-0.62, 0.7, -0.62, 1.24, 0.25, 1.24)}}`);
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
      this.speech.say(`${ts.nick || ts.name} ist jetzt auf Platz eins und neuer Ehrenbürgermeister!`, true);
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
