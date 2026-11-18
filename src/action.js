// Mehr Action im LIVE:
//  1. Like-Ziele: gemeinsames Ziel ("Noch 200 Likes bis Meteorregen"), danach grosses Event
//  2. Nord gegen Sued: regelmaessiges Like-Duell der beiden Stadthaelften
//  3. Chat-Befehle: "farbe rot", "haustier katze", "party"
import { BASE, plotCenter } from './city.js';
import { sleep } from './minecraft.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (n) => Math.round(n).toLocaleString('de-DE');
const spoken = (p) => (p.nick || p.name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim() || p.name;

const COLORS = {
  rot: 'red', blau: 'blue', hellblau: 'light_blue', türkis: 'cyan', tuerkis: 'cyan', grün: 'lime', gruen: 'lime',
  dunkelgrün: 'green', gelb: 'yellow', orange: 'orange', lila: 'purple', pink: 'pink', rosa: 'pink',
  schwarz: 'black', weiß: 'white', weiss: 'white', grau: 'gray', braun: 'brown', magenta: 'magenta',
};
const PETS = {
  katze: ['cat', 'Katze'], hund: ['wolf', 'Hund'], papagei: ['parrot', 'Papagei'], fuchs: ['fox', 'Fuchs'],
  hase: ['rabbit', 'Hase'], panda: ['panda', 'Panda'], schwein: ['pig', 'Schwein'], kuh: ['cow', 'Kuh'],
  schaf: ['sheep', 'Schaf'], huhn: ['chicken', 'Huhn'], pferd: ['horse', 'Pferd'], frosch: ['frog', 'Frosch'],
  axolotl: ['axolotl', 'Axolotl'], biene: ['bee', 'Biene'], lama: ['llama', 'Lama'], esel: ['donkey', 'Esel'],
};

const EVENTS = ['Meteorregen', 'Feuerwerk-Show', 'Regenbogen', 'Schneesturm', 'Party'];

export class Action {
  constructor({ game, builder, speech, broadcast, config = {}, log = console.log }) {
    this.game = game; this.builder = builder; this.mc = builder.mc;
    this.speech = speech; this.broadcast = broadcast; this.log = log;
    this.cfg = config;

    // Like-Ziel
    this.sessionLikes = 0;
    this.goalStart = 0;
    this.goalTarget = config.firstLikeGoal ?? 300;
    this.goalEvent = EVENTS[0];
    this.eventIndex = 0;

    // Duell
    this.duel = null;
    this.duelEvery = (config.duelEveryMinutes ?? 6) * 60_000;
    this.duelLength = (config.duelSeconds ?? 90) * 1000;
    this.teams = new Map(); // Spieler-ID -> 'nord' | 'sued' (frei gewaehlt)
    setTimeout(() => this.startDuel(), 3 * 60_000);
    setInterval(() => { if (!this.duel) this.startDuel(); }, this.duelEvery);

    this.cooldown = new Map();
    setInterval(() => this.pushGoal(), 5000);
  }

  // ---------- Hilfen ----------

  team(p) {
    if (this.teams.has(p.id)) return this.teams.get(p.id);
    if (p.plot === null) return null;
    const { x, z } = plotCenter(p.plot); // automatisch nach Lage des Hauses
    return z < 0 || (z === 0 && x < 0) ? 'nord' : 'sued';
  }

  ready(key, ms) {
    const now = Date.now();
    if (now - (this.cooldown.get(key) || 0) < ms) return false;
    this.cooldown.set(key, now);
    return true;
  }

  // ---------- Ereignisse aus game.js ----------

  onLike(p, count) {
    this.sessionLikes += count;
    if (this.duel) this.addDuel(p, count);
    if (this.sessionLikes - this.goalStart >= this.goalTarget) this.goalReached();
  }

  onGift(p, coins) {
    if (this.duel) this.addDuel(p, coins * 10); // 1 Coin zaehlt im Duell wie 10 Likes
  }

  /** Gibt true zurueck, wenn die Nachricht ein Befehl war. */
  onChat(p, text) {
    const t = text.toLowerCase().trim();
    let m;
    if ((m = t.match(/^(nord|norden|süd|sued|süden|sueden)\b/))) {
      const team = m[1].startsWith('n') ? 'nord' : 'sued';
      this.teams.set(p.id, team);
      this.broadcast({ type: 'ticker', text: `@${p.name} kämpft für ${team === 'nord' ? 'NORD 🔵' : 'SÜD 🔴'}!` });
      if (this.ready('teamtalk', 15_000)) this.speech.say(`${spoken(p)} ist im Team ${team === 'nord' ? 'Nord' : 'Süd'}!`);
      return true;
    }
    if ((m = t.match(/^farbe\s+(\S+)/))) return this.cmdColor(p, m[1]), true;
    if ((m = t.match(/^haustier\s+(\S+)/))) return this.cmdPet(p, m[1]), true;
    if (/^party\b/.test(t)) return this.cmdParty(p), true;
    return false;
  }

  // ---------- 1. Like-Ziele ----------

  pushGoal() {
    if (this.duel) return;
    this.broadcast({ type: 'goal', name: this.goalEvent, cur: this.sessionLikes - this.goalStart, target: this.goalTarget });
  }

  goalReached() {
    const event = this.goalEvent;
    this.goalStart = this.sessionLikes;
    this.goalTarget = Math.round((this.goalTarget * 1.35) / 50) * 50;
    this.eventIndex++;
    this.goalEvent = EVENTS[this.eventIndex % EVENTS.length];
    this.speech.say(`Like-Ziel geschafft! Jetzt kommt: ${event}! Danke an alle!`, true);
    this.broadcast({ type: 'banner', title: '🎯 LIKE-ZIEL GESCHAFFT!', text: event, big: true });
    this.broadcast({ type: 'confetti', amount: 150 });
    this.builder.enqueue({ type: 'fn', fn: () => this.runEvent(event) });
    this.pushGoal();
    setTimeout(() => this.speech.say(`Neues Ziel: ${fmt(this.goalTarget)} Likes für ${this.goalEvent}! Los geht's!`), 9000);
  }

  async runEvent(name) {
    const mc = this.mc, b = this.builder;
    await b.camera(0, BASE + 40, 60, 0, BASE + 4, 0);
    if (name === 'Meteorregen') {
      await mc.send('time set night');
      for (let i = 0; i < 26; i++) {
        const x = Math.round((Math.random() - 0.5) * 120), z = Math.round((Math.random() - 0.5) * 120);
        for (let y = 45; y >= 3; y -= 7) {
          await mc.send(`particle minecraft:flame ${x + (45 - y) * 0.4} ${BASE + y} ${z} 0.4 0.4 0.4 0.02 40 force`);
          await mc.send(`particle minecraft:large_smoke ${x + (45 - y) * 0.4} ${BASE + y} ${z} 0.3 0.3 0.3 0.01 15 force`);
          await sleep(45);
        }
        await mc.send(`particle minecraft:explosion_emitter ${x} ${BASE + 1} ${z} 0 0 0 0 1 force`);
        await mc.send(`particle minecraft:lava ${x} ${BASE + 1} ${z} 1 0.5 1 0 25 force`);
        await mc.send(`playsound minecraft:entity.generic.explode master @a ${x} ${BASE} ${z} 3 0.7`);
        await sleep(250);
      }
      await sleep(1500);
      await mc.send('time set noon');
    } else if (name === 'Feuerwerk-Show') {
      await mc.send('time set midnight');
      await b.fireworkShow(0, 0, 40, 40);
      await sleep(3000);
      await mc.send('time set noon');
    } else if (name === 'Regenbogen') {
      const cols = ['red', 'orange', 'yellow', 'lime', 'light_blue', 'purple'];
      for (let k = 0; k < cols.length; k++) {
        const r = 30 - k;
        for (let a = 0; a <= 180; a += 2) {
          const x = Math.round(Math.cos((a * Math.PI) / 180) * r), y = Math.round(Math.sin((a * Math.PI) / 180) * r);
          await mc.send(`setblock ${x} ${BASE + y} -2 ${cols[k]}_stained_glass keep`);
        }
      }
      await mc.send(`particle minecraft:end_rod 0 ${BASE + 22} -2 20 8 1 0.05 300 force`);
      await mc.send('playsound minecraft:block.amethyst_block.chime master @a 0 -50 0 3 1');
      await sleep(25000);
      for (const c of cols) await mc.send(`fill -31 ${BASE} -2 31 ${BASE + 31} -2 air replace ${c}_stained_glass`);
    } else if (name === 'Schneesturm') {
      await mc.send('weather rain');
      for (let i = 0; i < 40; i++) {
        await mc.send(`particle minecraft:snowflake 0 ${BASE + 25} 0 50 15 50 0.02 1500 force`);
        await sleep(400);
      }
      await mc.send('weather clear');
    } else {
      await this.game.bigEvent({ name: 'Meme City', nick: 'alle' });
    }
  }

  // ---------- 2. Nord gegen Sued ----------

  startDuel() {
    if (this.duel) return;
    this.duel = { nord: 0, sued: 0, end: Date.now() + this.duelLength, fighters: new Map(), half: false, last10: false };
    this.speech.say('Achtung! Nord gegen Süd beginnt! Schreibt nord oder süd in den Chat und liked für euer Team!', true);
    this.broadcast({ type: 'banner', title: '⚔️ NORD GEGEN SÜD', text: 'Schreib „nord“ oder „süd“ und like für dein Team!', big: true });
    this.timer = setInterval(() => this.tickDuel(), 1000);
  }

  addDuel(p, n) {
    const team = this.team(p);
    if (!team) return;
    this.duel[team] += n;
    this.duel.fighters.set(p.id, team);
  }

  tickDuel() {
    const d = this.duel;
    const left = Math.max(0, Math.ceil((d.end - Date.now()) / 1000));
    this.broadcast({ type: 'duel', nord: d.nord, sued: d.sued, left });
    const lead = d.nord === d.sued ? null : d.nord > d.sued ? 'Nord' : 'Süd';
    if (!d.half && left <= this.duelLength / 2000) {
      d.half = true;
      this.speech.say(lead ? `Halbzeit! ${lead} führt! Gebt alles!` : 'Halbzeit! Noch steht es unentschieden!');
    }
    if (!d.last10 && left <= 10) {
      d.last10 = true;
      this.speech.say('Noch zehn Sekunden! Tippt, was das Zeug hält!', true);
    }
    if (left <= 0) this.endDuel();
  }

  endDuel() {
    clearInterval(this.timer);
    const d = this.duel; this.duel = null;
    const winner = d.nord === d.sued ? null : d.nord > d.sued ? 'nord' : 'sued';
    this.broadcast({ type: 'duel', end: true, nord: d.nord, sued: d.sued, winner });
    if (!winner) {
      this.speech.say('Unentschieden! Beim nächsten Duell gibt es eine Revanche!', true);
      return;
    }
    const W = winner === 'nord' ? 'Nord' : 'Süd';
    let n = 0;
    for (const [id, team] of d.fighters) {
      const p = this.game.store.players[id];
      if (team === winner && p) { this.game.addPoints(p, 10); n++; }
    }
    this.speech.say(`${W} gewinnt das Duell! ${n} Kämpfer bekommen zehn Bonuspunkte für ihr Haus!`, true);
    this.broadcast({ type: 'banner', title: `🏆 ${W.toUpperCase()} GEWINNT!`, text: `+10 Punkte für ${n} Kämpfer*innen`, big: true });
    this.broadcast({ type: 'confetti', amount: 120 });
    this.builder.enqueue({ type: 'fn', fn: async () => {
      const sz = winner === 'nord' ? -1 : 1;
      await this.builder.camera(0, BASE + 45, -sz * 50, 0, BASE, sz * 50);
      for (let i = 0; i < 20; i++) {
        await this.builder.firework(Math.round((Math.random() - 0.5) * 140), BASE + 2, sz * (30 + Math.round(Math.random() * 60)), i % 4 === 0);
        await sleep(200);
      }
      await sleep(2500);
    } });
    this.game.pushState();
  }

  // ---------- 3. Chat-Befehle ----------

  cmdColor(p, word) {
    const c = COLORS[word.replace(/[^a-zäöüß]/g, '')];
    if (p.plot === null) return this.speech.say(`${spoken(p)}, du brauchst zuerst ein Haus. Schreib Haus!`);
    if (!c) return this.broadcast({ type: 'ticker', text: `Farben: ${Object.keys(COLORS).filter((k) => !/ue|ss/.test(k)).join(', ')}` });
    if (!this.ready('farbe:' + p.id, 60_000)) return;
    p.color = c;
    this.game.store.save();
    this.speech.say(pick([`${spoken(p)} streicht das Dach in ${word}!`, `Neue Farbe für ${spoken(p)}: ${word}!`]));
    this.builder.enqueue({ type: 'build', player: p, instant: true });
    this.builder.enqueue({ type: 'camera', player: p });
  }

  cmdPet(p, word) {
    const pet = PETS[word.replace(/[^a-zäöüß]/g, '')];
    if (p.plot === null) return this.speech.say(`${spoken(p)}, dein Haustier braucht ein Zuhause. Schreib zuerst Haus!`);
    if (!pet) return this.broadcast({ type: 'ticker', text: `Haustiere: ${Object.keys(PETS).join(', ')}` });
    if (!this.ready('pet:' + p.id, 60_000)) return;
    const { x, z } = plotCenter(p.plot);
    const name = JSON.stringify(`${p.name}s ${pet[1]}`);
    p.pet = pet[0];
    this.game.store.save();
    this.speech.say(pick([`${spoken(p)} bekommt einen ${pet[1]}! Wie süß!`, `Ein neuer Mitbewohner: ${pet[1]} für ${spoken(p)}!`]));
    this.builder.enqueue({ type: 'camera', player: p });
    this.builder.enqueue({ type: 'fn', fn: async () => {
      await this.mc.send(`kill @e[tag=mc_pet_${p.plot}]`);
      await this.mc.send(`summon ${pet[0]} ${x + 4} ${BASE} ${z + 4} {Tags:["mc_pet","mc_pet_${p.plot}"],PersistenceRequired:1b,CustomName:${name},CustomNameVisible:1b}`);
      await this.mc.send(`particle minecraft:heart ${x + 4} ${BASE + 1.5} ${z + 4} 0.6 0.4 0.6 0 12 force`);
    } });
  }

  cmdParty(p) {
    if (p.plot === null) return this.speech.say(`${spoken(p)}, ohne Haus keine Party! Schreib Haus!`);
    if (!this.ready('party:' + p.id, 120_000) || !this.ready('party', 20_000)) return;
    const { x, z } = plotCenter(p.plot);
    this.speech.say(pick([`Party bei ${spoken(p)}! Alle hin da!`, `${spoken(p)} schmeißt eine Party!`]));
    this.builder.enqueue({ type: 'camera', player: p });
    this.builder.enqueue({ type: 'fn', fn: async () => {
      await this.mc.send(`particle minecraft:note ${x} ${BASE + 6} ${z} 4 2 4 1 40 force`);
      await this.mc.send(`playsound minecraft:block.note_block.bell master @a ${x} ${BASE} ${z} 2 1.2`);
      await this.builder.fireworkShow(x, z, 6, 4);
    } });
  }
}
