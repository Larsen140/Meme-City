// Mehr Action im LIVE:
//  1. Like-Ziele: gemeinsames Ziel ("Noch 200 Likes bis Meteorregen"), danach grosses Event
//  2. Nord gegen Sued: regelmaessiges Like-Duell der beiden Stadthaelften
//  3. Chat-Befehle: "farbe rot", "haustier katze", "party"
import { BASE, plotCenter, frontOf } from './city.js';
import { sleep } from './minecraft.js';
import { closest } from './typo.js';

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
  fisch: ['tropical_fish', 'Fisch'], schildkröte: ['turtle', 'Schildkröte'], schildkroete: ['turtle', 'Schildkröte'], bär: ['polar_bear', 'Eisbär'], baer: ['polar_bear', 'Eisbär'], eisbär: ['polar_bear', 'Eisbär'],
  ziege: ['goat', 'Ziege'], kamel: ['camel', 'Kamel'], wolf: ['wolf', 'Wolf'], ente: ['chicken', 'Ente'], pinguin: ['penguin', 'Pinguin'], kaninchen: ['rabbit', 'Kaninchen'], katz: ['cat', 'Katze'],
};

/** Tierwort erkennen, auch Mehrzahl/Verkleinerung: "hunde", "katzen", "kätzchen", "hündchen" */
function findPet(word) {
  const norm = (s) => s.toLowerCase().replace(/ä/g, 'a').replace(/ü/g, 'u').replace(/ö/g, 'o');
  const w = norm(word).replace(/chen$|lein$/, '');
  if (!w) return null;
  for (const [k, v] of Object.entries(PETS)) {
    const kk = norm(k);
    if (w === kk || w === kk + 'e' || w === kk + 'n' || w === kk + 'en' || (kk.length >= 4 && w.startsWith(kk))) return v;
  }
  if (/^kat/.test(w)) return PETS.katze;
  if (/^hun|^dog/.test(w)) return PETS.hund;
  const k = closest(w, Object.keys(PETS)); // Tippfehler: "pingiun", "kaze"
  return k ? PETS[k] : null;
}

// Pinguin gibt es in Minecraft nicht -> kleines Modell aus Block-Displays (schaut nach vorne = Sueden bei yaw 0)
const PENGUIN = [
  ['black_concrete', -0.3, 0.08, -0.25, 0.6, 0.7, 0.5],     // Koerper
  ['white_concrete', -0.22, 0.12, 0.2, 0.44, 0.56, 0.09],   // Bauch
  ['black_concrete', -0.37, 0.2, -0.15, 0.08, 0.48, 0.34],  // Fluegel links
  ['black_concrete', 0.29, 0.2, -0.15, 0.08, 0.48, 0.34],   // Fluegel rechts
  ['black_concrete', -0.23, 0.78, -0.2, 0.46, 0.4, 0.42],   // Kopf
  ['white_concrete', -0.17, 0.83, 0.17, 0.34, 0.26, 0.08],  // Gesicht
  ['black_concrete', -0.12, 0.96, 0.24, 0.07, 0.08, 0.03],  // Auge
  ['black_concrete', 0.05, 0.96, 0.24, 0.07, 0.08, 0.03],   // Auge
  ['orange_concrete', -0.06, 0.87, 0.22, 0.12, 0.07, 0.14], // Schnabel
  ['orange_concrete', -0.24, 0, -0.02, 0.19, 0.08, 0.3],    // Fuss
  ['orange_concrete', 0.05, 0, -0.02, 0.19, 0.08, 0.3],     // Fuss
];
async function summonPenguin(mc, x, z, yaw, plot, label) {
  const tags = `Tags:["mc_pet","mc_pet_${plot}"]`;
  const px = x + 0.5, pz = z + 0.5;
  let r = '';
  const S = 1.4; // etwas groesser, damit man ihn auf dem Handy gut sieht
  for (const [b, ...v] of PENGUIN) {
    const [tx, ty, tz, sx, sy, sz] = v.map((n) => +(n * S).toFixed(3));
    r = await mc.send(`summon block_display ${px} ${BASE} ${pz} {${tags},Rotation:[${yaw}f,0f],block_state:"minecraft:${b}",transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${tx}f,${ty}f,${tz}f],scale:[${sx}f,${sy}f,${sz}f]}}`);
  }
  await mc.send(`summon text_display ${px} ${BASE + 1.9} ${pz} {${tags},billboard:"center",text:${JSON.stringify(label)},background:1073741824}`);
  return r;
}

const EVENTS = ['Tornado', 'Meteorregen', 'Tsunami', 'Feuerwerk-Show', 'Regenbogen', 'Tornado', 'Meteorregen', 'Tsunami', 'Schneesturm', 'Party'];

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
    // Stand des Like-Ziels ueber Neustarts retten (wenn juenger als 2 Stunden)
    const saved = game.store.data.likeGoal;
    this.firstGoal = this.goalTarget;
    if (saved && Date.now() - saved.at < 2 * 3600_000) Object.assign(this, { roomId: saved.roomId, sessionLikes: saved.sessionLikes, goalStart: saved.goalStart, goalTarget: saved.goalTarget, eventIndex: saved.eventIndex, goalEvent: EVENTS[saved.eventIndex % EVENTS.length] });

    // Duell
    this.duel = null;
    this.duelEvery = (config.duelEveryMinutes ?? 6) * 60_000;
    this.duelLength = (config.duelSeconds ?? 90) * 1000;
    this.teams = new Map(); // Spieler-ID -> 'nord' | 'sued' (frei gewaehlt)
    this.nextDuelAt = Date.now() + 3 * 60_000;
    this.nextRaffleAt = Date.now() + 4 * 60_000; // naechste Abstimmung
    this.vote = null;
    this.raffle = null;
    this.active = new Map(); // Spieler-ID -> letzte Aktivitaet (Chat/Like)
    // Zeitplan: Duell, Verlosung, Treue-Bonus
    setInterval(() => {
      const now = Date.now();
      if (!this.duel && !this.raffle && !this.vote && now >= this.nextDuelAt) { this.nextDuelAt = now + this.duelEvery; this.startDuel(); }
      if (!this.duel && !this.raffle && !this.vote && now >= this.nextRaffleAt) { this.nextRaffleAt = now + (config.voteEveryMinutes ?? 7) * 60_000; this.startVote(); }
    }, 1000);
    setInterval(() => this.loyaltyBonus(), (config.loyaltyMinutes ?? 5) * 60_000);

    this.cooldown = new Map();
    setInterval(() => this.pushGoal(), 5000);
  }

  /** Neuer LIVE (anderer Raum): Like-Ziel wieder klein anfangen. Gleicher Raum nach Neustart: Stand behalten. */
  newRoom(roomId) {
    if (!roomId || roomId === this.roomId) return;
    const first = this.roomId === undefined && this.sessionLikes === 0;
    this.roomId = roomId;
    if (!first) this.log(`[Like-Ziel] neuer LIVE – Ziel zurückgesetzt`);
    Object.assign(this, { sessionLikes: 0, goalStart: 0, goalTarget: this.firstGoal, eventIndex: 0, goalEvent: EVENTS[0] });
    this.pushGoal();
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
    this.active.set(p.id, Date.now());
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
    this.active.set(p.id, Date.now());
    if (this.raffle && /^(ich|dabei|bin dabei|hier|me)(\s|!|\.|$)/.test(t)) {
      if (!this.raffle.entries.has(p.id)) {
        this.raffle.entries.add(p.id);
        this.broadcast({ type: 'ticker', text: `🎟️ @${p.name} ist bei der Verlosung dabei! (${this.raffle.entries.size} Teilnehmer)` });
      }
      return true;
    }
    if (this.vote) {
      const i = /^[1-3](\s|!|\.|$)/.test(t) ? Number(t[0]) - 1 : this.vote.options.findIndex((o) => t.startsWith(o.toLowerCase().slice(0, 5)));
      if (i >= 0 && i < 3) {
        const first = !this.vote.votes.has(p.id);
        this.vote.votes.set(p.id, i);
        if (first) this.broadcast({ type: 'ticker', text: `🗳️ @${p.name} stimmt für **${this.vote.options[i]}**` });
        this.game.ack(p, `🗳️ Deine Stimme: **${this.vote.options[i]}**`);
        return true;
      }
    }
    let m;
    if ((m = t.match(/^(nord|norden|süd|sued|süden|sueden)\b/))) {
      const team = m[1].startsWith('n') ? 'nord' : 'sued';
      this.teams.set(p.id, team);
      this.broadcast({ type: 'ticker', text: `@${p.name} kämpft für ${team === 'nord' ? 'NORD 🔵' : 'SÜD 🔴'}!` });
      this.game.ack(p, team === 'nord' ? '🔵 Du bist im Team **NORD**' : '🔴 Du bist im Team **SÜD**');
      if (this.ready('teamtalk', 15_000)) this.speech.say(`${spoken(p)} ist im Team ${team === 'nord' ? 'Nord' : 'Süd'}!`);
      return true;
    }
    // Befehle duerfen irgendwo im Satz stehen: "ich will haustier hund", "Haustier: Katze", "farbe vom dach rot"
    const words = t.replace(/[^a-zäöüß ]/g, ' ').split(/\s+/).filter(Boolean);
    if (/haustier|\bpet\b/.test(t)) {
      const w = words.find((x) => !/haustier|^pet$|^mein$|^ein$|^eine$|^will$|^ich$/.test(x) && findPet(x));
      if (!w && /[?]|^(wie|was|wo|welche|kann|gibt)/.test(t)) return false; // Frage -> beantwortet der Buergermeister
      this.log(`[Befehl] @${p.name}: ${text}`);
      return this.cmdPet(p, w || ''), true;
    }
    if (/farbe|color/.test(t)) {
      const w = words.find((x) => COLORS[x]) || words.map((x) => (x.length >= 3 && !/farbe|color|dach/.test(x) ? closest(x, Object.keys(COLORS)) : null)).find(Boolean);
      if (!w && /[?]|^(wie|was|wo|welche|kann|gibt)/.test(t)) return false; // Frage -> beantwortet der Buergermeister
      this.log(`[Befehl] @${p.name}: ${text}`);
      return this.cmdColor(p, w || ''), true;
    }
    if (/\bparty\b/.test(t)) { this.log(`[Befehl] @${p.name}: ${text}`); return this.cmdParty(p), true; }
    return false;
  }

  // ---------- 1. Like-Ziele ----------

  pushGoal() {
    this.game.store.data.likeGoal = { at: Date.now(), roomId: this.roomId, sessionLikes: this.sessionLikes, goalStart: this.goalStart, goalTarget: this.goalTarget, eventIndex: this.eventIndex };
    this.game.store.save();
    if (this.duel || this.raffle || this.vote) return;
    const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    const now = Date.now();
    const next = this.nextDuelAt < this.nextRaffleAt
      ? `⚔️ Duell in ${mmss(this.nextDuelAt - now)}` : `🗳️ Abstimmung in ${mmss(this.nextRaffleAt - now)}`;
    this.broadcast({ type: 'goal', name: this.goalEvent, cur: this.sessionLikes - this.goalStart, target: this.goalTarget, next });
  }

  // ---------- Abstimmung: der Chat entscheidet, was als Naechstes passiert (haelt Zuschauer im LIVE) ----------

  startVote() {
    const pool = [...new Set(EVENTS)].filter((e) => e !== 'Party').sort(() => Math.random() - 0.5);
    const options = pool.slice(0, 3);
    this.vote = { options, votes: new Map(), end: Date.now() + 50_000 };
    this.log('[Abstimmung] ' + options.join(' / '));
    this.speech.say(`Abstimmung! Was soll gleich in Meme City passieren? Schreib eins für ${options[0]}, zwei für ${options[1]} oder drei für ${options[2]}!`, true);
    this.broadcast({ type: 'banner', title: '🗳️ IHR ENTSCHEIDET!', text: options.map((o, i) => `${i + 1} = ${o}`).join('   '), big: true });
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.vote.end - Date.now()) / 1000));
      const counts = [0, 0, 0]; for (const v of this.vote.votes.values()) counts[v]++;
      this.broadcast({ type: 'vote', left, options, counts });
      if (left === 25) this.speech.say('Noch fünfundzwanzig Sekunden! Schreib eins, zwei oder drei!');
      if (left === 8) this.speech.say('Gleich wird entschieden!');
      if (left <= 0) { clearInterval(tick); this.endVote(counts); }
    }, 1000);
  }

  endVote(counts) {
    const { options, votes } = this.vote;
    this.vote = null;
    const max = Math.max(...counts);
    const best = counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
    const win = options[best[Math.floor(Math.random() * best.length)]];
    this.log(`[Abstimmung] ${votes.size} Stimmen -> ${win}`);
    this.broadcast({ type: 'vote', end: true, winner: win, count: votes.size });
    this.speech.say(votes.size ? `Entschieden! ${votes.size === 1 ? 'Eine Stimme' : votes.size + ' Stimmen'}, und es wird: ${win}!` : `Keiner hat gewählt, also entscheide ich: ${win}!`, true);
    this.broadcast({ type: 'banner', title: `🗳️ ES WIRD: ${win.toUpperCase()}!`, text: votes.size ? `${votes.size} Stimmen aus dem Chat` : 'Der Bürgermeister hat entschieden', big: true });
    // jede Stimme zaehlt auch fuers eigene Haus
    for (const id of votes.keys()) { const p = this.game.store.players[id]; if (p && p.plot !== null) this.game.addPoints(p, 1); }
    this.builder.enqueue({ type: 'fn', fn: () => this.runEvent(win) });
  }

  // ---------- Verlosung: wer "ich" schreibt, kann ein Gratis-Upgrade gewinnen ----------

  startRaffle() {
    this.raffle = { entries: new Set(), end: Date.now() + 60_000 };
    this.log('[Verlosung] gestartet');
    this.speech.say('Verlosung! Wer in der nächsten Minute ich in den Chat schreibt, kann ein Gratis-Upgrade fürs Haus gewinnen!', true);
    this.broadcast({ type: 'banner', title: '🎟️ VERLOSUNG!', text: 'Schreib „ich“ in den Chat – Gewinn: 1 Stufe fürs Haus!', big: true });
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.raffle.end - Date.now()) / 1000));
      this.broadcast({ type: 'raffle', left, count: this.raffle.entries.size });
      if (left === 30) this.speech.say(`Noch dreißig Sekunden! Schon ${this.raffle.entries.size} Leute sind dabei. Schreib ich!`);
      if (left === 10) this.speech.say('Noch zehn Sekunden für die Verlosung!');
      if (left <= 0) { clearInterval(tick); this.drawRaffle(); }
    }, 1000);
  }

  drawRaffle() {
    const ids = [...this.raffle.entries];
    this.log(`[Verlosung] ${ids.length} Teilnehmer`);
    this.raffle = null;
    if (!ids.length) {
      this.speech.say('Niemand hat mitgemacht. Schade! In ein paar Minuten gibt es die nächste Verlosung.');
      return;
    }
    const p = this.game.store.players[ids[Math.floor(Math.random() * ids.length)]];
    this.broadcast({ type: 'raffle', end: true, winner: p.name, avatar: p.avatar, count: ids.length });
    this.speech.say(`Trommelwirbel! Gewonnen hat: ${spoken(p)}! Herzlichen Glückwunsch!`, true);
    this.broadcast({ type: 'banner', title: `🎉 GEWINNER: @${p.name}`, text: `von ${ids.length} Teilnehmer*innen – Gratis-Upgrade!`, avatar: p.avatar, big: true });
    this.broadcast({ type: 'confetti', amount: 180 });
    if (p.plot === null) this.game.claimHouse(p, 'chat');
    // genau so viele Punkte, dass es fuer die naechste Stufe reicht
    const c = this.game.card(p);
    const need = c.nextLevel ? Math.max(1, Math.ceil(c.coinsNeeded)) : 0;
    if (need) this.game.addPoints(p, need);
    else this.builder.enqueue({ type: 'camera', player: p });
  }

  // ---------- Treue-Bonus: wer aktiv dabei bleibt, bekommt Punkte ----------

  loyaltyBonus() {
    const now = Date.now(), win = 5 * 60_000;
    const lucky = [...this.active.entries()].filter(([, t]) => now - t < win).map(([id]) => this.game.store.players[id]).filter(Boolean);
    if (!lucky.length) return;
    for (const p of lucky) this.game.addPoints(p, 2);
    this.broadcast({ type: 'ticker', text: `💎 Treue-Bonus: ${lucky.length} aktive Bürger*innen bekommen +2 Punkte fürs Dabeibleiben!`, highlight: true });
    this.speech.say(`Treue-Bonus! ${lucky.length} aktive Bürger bekommen zwei Punkte fürs Dabeibleiben. Bleibt dran, alle fünf Minuten gibt es mehr!`);
    this.game.pushState();
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
      // Echte gluehende Gesteinsbrocken fliegen schraeg vom Himmel – reine Optik, es geht NICHTS kaputt
      // (Block-Anzeigen + Partikel, keine echten Explosionen, keine Bloecke werden veraendert).
      this.speech.say('Achtung, Meteoriten! Keine Sorge, Meme City ist geschützt!', true);
      await b.camera(0, BASE + 30, 75, 0, BASE + 8, 0, 2.5);
      await mc.send('time set 14000');
      const T = (s) => `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${-s / 2}f,${-s / 2}f,${-s / 2}f],scale:[${s}f,${s}f,${s}f]}`;
      const one = async (i) => {
        const tx = Math.round((Math.random() - 0.5) * 110), tz = Math.round((Math.random() - 0.5) * 70);
        const sx = tx - 30, sy = BASE + 60, sz = tz - 20; // Start schraeg oben
        const tag = `mc_meteor_${Date.now()}_${i}`, size = 3.5 + Math.random() * 2.5;
        await mc.send(`summon block_display ${sx} ${sy} ${sz} {Tags:["${tag}","mc_gift_tmp"],teleport_duration:24,brightness:{sky:15,block:15},block_state:"minecraft:magma_block",${T(size)}}`);
        await mc.send(`summon block_display ${sx} ${sy} ${sz} {Tags:["${tag}","mc_gift_tmp"],teleport_duration:24,brightness:{sky:15,block:15},block_state:"minecraft:shroomlight",${T(size * 0.7)}}`);
        await sleep(120);
        await mc.send(`tp @e[tag=${tag}] ${tx} ${BASE + 1} ${tz}`); // fliegt in 1,2 s weich herunter
        // Feuerschweif entlang der Flugbahn
        for (let k = 0; k < 6; k++) {
          const f = k / 6, px = sx + (tx - sx) * f, py = sy + (BASE + 1 - sy) * f, pz = sz + (tz - sz) * f;
          await mc.send(`particle minecraft:flame ${px.toFixed(1)} ${py.toFixed(1)} ${pz.toFixed(1)} 0.6 0.6 0.6 0.03 30 force`);
          await mc.send(`particle minecraft:campfire_cosy_smoke ${px.toFixed(1)} ${py.toFixed(1)} ${pz.toFixed(1)} 0.4 0.4 0.4 0.01 6 force`);
          await sleep(200);
        }
        // Einschlag: Lichtblitz, Funken, Staubring – ohne Schaden
        await mc.send(`particle minecraft:flash{color:[1.0,0.6,0.2,1.0]} ${tx} ${BASE + 2} ${tz} 0 0 0 0 1 force`);
        await mc.send(`particle minecraft:lava ${tx} ${BASE + 1} ${tz} 1.5 0.5 1.5 0 30 force`);
        await mc.send(`particle minecraft:large_smoke ${tx} ${BASE + 1} ${tz} 2 0.5 2 0.05 40 force`);
        for (let a = 0; a < 360; a += 30) {
          const r = 3, ax = tx + Math.cos((a * Math.PI) / 180) * r, az = tz + Math.sin((a * Math.PI) / 180) * r;
          await mc.send(`particle minecraft:poof ${ax.toFixed(1)} ${BASE + 0.5} ${az.toFixed(1)} 0.2 0.1 0.2 0.08 4 force`);
        }
        await mc.send(`playsound minecraft:entity.generic.explode master @a ${tx} ${BASE} ${tz} 3 0.6`);
        await sleep(400);
        await mc.send(`kill @e[tag=${tag}]`);
      };
      const jobs = [];
      for (let i = 0; i < 16; i++) { jobs.push(one(i)); await sleep(450); }
      await Promise.all(jobs);
      await sleep(1500);
      await mc.send('time set noon');
      this.speech.say('Puh! Alle Meteoriten sind verglüht. Meme City steht noch!');
    } else if (name === 'Tsunami') {
      // Riesige Welle rollt ueber die Stadt – nur Optik: Block-Anzeigen + Gischt, kein echtes Wasser
      this.speech.say('Achtung, Tsunami! Alle festhalten!', true);
      await b.camera(0, BASE + 26, 95, 0, BASE + 8, 0, 2.5);
      const tag = `mc_tsunami_${Date.now()}`;
      const W = (tx, ty, tz, sx, sy, sz) => `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${tx}f,${ty}f,${tz}f],scale:[${sx}f,${sy}f,${sz}f]}`;
      // Welle: Abschnitte quer ueber die Stadt (x), sie rollt von hinten (z=-110) nach vorne
      for (let x = -90; x < 90; x += 20) {
        const h = 14 + Math.round(Math.random() * 4);
        await mc.send(`summon block_display ${x} ${BASE} -88 {Tags:["${tag}","mc_gift_tmp"],teleport_duration:40,block_state:"minecraft:blue_stained_glass",${W(0, 0, 0, 20, h, 6)}}`);
        await mc.send(`summon block_display ${x} ${BASE} -88 {Tags:["${tag}","mc_gift_tmp"],teleport_duration:40,block_state:"minecraft:light_blue_stained_glass",${W(0, h, 1, 20, 3, 5)}}`);
        await mc.send(`summon block_display ${x} ${BASE} -88 {Tags:["${tag}","mc_gift_tmp"],teleport_duration:40,brightness:{sky:15,block:15},block_state:"minecraft:white_concrete_powder",${W(0, h + 3, 2.5, 20, 1, 3)}}`);
      }
      await mc.send(`playsound minecraft:ambient.underwater.enter master @a 0 ${BASE} 0 4 0.5`);
      await sleep(200);
      for (let step = 0; step < 5; step++) {
        await mc.send(`execute as @e[tag=${tag}] at @s run tp @s ~ ~ ~30`);
        const z = -88 + (step + 1) * 30;
        for (let x = -90; x <= 90; x += 30) {
          await mc.send(`particle minecraft:splash ${x} ${BASE + 2} ${z} 10 2 3 0.5 300 force`);
          await mc.send(`particle minecraft:cloud ${x} ${BASE + 16} ${z} 10 1 2 0.05 30 force`);
        }
        await mc.send(`playsound minecraft:weather.rain master @a 0 ${BASE} ${z} 4 0.6`);
        await sleep(2000);
      }
      // Welle sinkt ab und verschwindet
      await mc.send(`execute as @e[tag=${tag}] at @s run tp @s ~ ~-20 ~10`);
      await mc.send(`particle minecraft:splash 0 ${BASE + 2} 110 60 2 6 0.5 1500 force`);
      await sleep(2000);
      await mc.send(`kill @e[tag=${tag}]`);
      this.speech.say('Die Welle ist weg, und alles ist noch da! Meme City ist unsinkbar!');
    } else if (name === 'Tornado') {
      // Tornado zieht quer durch die Stadt (nur Partikel – nichts geht kaputt)
      this.speech.say('Achtung! Ein Tornado zieht über Meme City! Haltet euch fest!', true);
      await b.camera(0, BASE + 20, 100, 0, BASE + 16, 15, 2.5);
      await mc.send('time set 12500');
      // naeher an der Kamera: quer vor dem Stadtplatz entlang
      const dur = 16000, start = Date.now(), from = { x: -70, z: 40 }, to = { x: 70, z: 25 };
      let step = 0;
      while (Date.now() - start < dur) {
        const t = (Date.now() - start) / dur;
        const cx = from.x + (to.x - from.x) * t + Math.sin(t * 9) * 4, cz = from.z + (to.z - from.z) * t + Math.cos(t * 7) * 4;
        const cmds = [];
        for (let h = 0; h <= 40; h += 2) {
          const r = 0.8 + h * 0.22, a = step * 0.9 + h * 0.35;
          const px = cx + Math.cos(a) * r * 0.7, pz = cz + Math.sin(a) * r * 0.7;
          const g = (0.25 + h / 160).toFixed(2);
          cmds.push(`particle minecraft:dust{color:[${g},${g},${(+g + 0.05).toFixed(2)}],scale:4.0} ${px.toFixed(1)} ${BASE + h} ${pz.toFixed(1)} ${(r * 0.35).toFixed(2)} 0.7 ${(r * 0.35).toFixed(2)} 0 ${8 + Math.floor(h / 5)} force`);
          if (h % 4 === 0) cmds.push(`particle minecraft:large_smoke ${px.toFixed(1)} ${BASE + h} ${pz.toFixed(1)} ${(r * 0.3).toFixed(2)} 0.5 ${(r * 0.3).toFixed(2)} 0.03 6 force`);
        }
        if (step % 2 === 0) {
          cmds.push(`particle minecraft:block{block_state:"minecraft:dirt"} ${cx.toFixed(1)} ${BASE + 3} ${cz.toFixed(1)} 3 2 3 0 60 force`);
          cmds.push(`particle minecraft:block{block_state:"minecraft:oak_leaves"} ${cx.toFixed(1)} ${BASE + 12} ${cz.toFixed(1)} 5 6 5 0 40 force`);
        }
        if (step % 8 === 0) cmds.push(`playsound minecraft:weather.rain master @a ${cx.toFixed(1)} ${BASE + 5} ${cz.toFixed(1)} 3 0.5`);
        await mc.sendAll(cmds);
        step++;
        await sleep(150);
      }
      await mc.send('time set noon');
      this.speech.say('Puh! Der Tornado ist weitergezogen. Alle Häuser stehen noch!');
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
      // kein echter Regen mehr – nur Schneeflocken als Effekt
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
    if (this.duel || this.raffle) return;
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
    if (p.plot === null) { this.game.ack(p, '🏠 Erst ein Haus – schreib **Haus**'); return this.speech.say(`${spoken(p)}, du brauchst zuerst ein Haus. Schreib Haus!`); }
    if (!c) {
      this.broadcast({ type: 'ticker', text: `🎨 Farben: ${Object.keys(COLORS).filter((k) => !/ue|ss/.test(k)).join(', ')}` });
      this.game.ack(p, '🎨 Farbe unbekannt – z. B. **farbe rot**, **farbe hellblau**');
      if (this.game.chatReplyReady(p, 20_000)) this.speech.say(`${spoken(p)}, die Farbe kenne ich nicht. Schreib zum Beispiel farbe rot, farbe hellblau oder farbe lila!`);
      return;
    }
    if (!this.ready('farbe:' + p.id, 60_000)) return this.waitHint(p, 'Farbe');
    this.game.ack(p, `🎨 Dach wird **${word}** gestrichen`);
    p.color = c;
    this.game.store.save();
    this.speech.say(pick([`${spoken(p)} streicht das Dach in ${word}!`, `Neue Farbe für ${spoken(p)}: ${word}!`]));
    this.builder.enqueue({ type: 'build', player: p, instant: true });
    this.builder.enqueue({ type: 'camera', player: p });
  }

  cmdPet(p, word) {
    const pet = findPet(word);
    if (p.plot === null) { this.game.ack(p, '🏠 Erst ein Haus – schreib **Haus**'); return this.speech.say(`${spoken(p)}, dein Haustier braucht ein Zuhause. Schreib zuerst Haus!`); }
    if (!pet) {
      this.broadcast({ type: 'ticker', text: `🐾 Haustiere: ${[...new Set(Object.values(PETS).map((v) => v[1]))].join(', ')}` });
      this.game.ack(p, '🐾 Tier unbekannt – z. B. **haustier katze**, **haustier pinguin**');
      if (this.game.chatReplyReady(p, 20_000)) this.speech.say(`${spoken(p)}, ${word ? 'das Tier haben wir leider nicht' : 'welches Tier willst du'}. Schreib zum Beispiel haustier katze, haustier pinguin oder haustier panda!`);
      return;
    }
    if (!this.ready('pet:' + p.id, 60_000)) return this.waitHint(p, 'Haustier');
    this.game.ack(p, `🐾 **${pet[1]}** zieht gleich bei dir ein`);
    const { x: cx, z: cz } = plotCenter(p.plot);
    // im Vorgarten (Seite zur Kamera) neben dem Weg – dort sieht man es immer
    const fr = frontOf(cx, cz);
    const x = cx + fr.dx * 5 + (fr.dz ? 3 : 0), z = cz + fr.dz * 5 + (fr.dx ? 3 : 0);
    const name = JSON.stringify(`${p.name}s ${pet[1]}`);
    p.pet = pet[0];
    this.game.store.save();
    this.game.pushState?.();
    this.speech.say(pick([`${spoken(p)} hat ein neues Haustier: ${pet[1]}! Wie süß!`, `Ein neuer Mitbewohner: ${pet[1]} für ${spoken(p)}!`]));
    this.builder.enqueue({ type: 'fn', fn: async () => {
      // Nahaufnahme: Kamera tief vor dem Vorgarten, Tier vorne, Haus dahinter
      await this.builder.petCamera(x, z, fr);
      await this.mc.send(`kill @e[tag=mc_pet_${p.plot}]`);
      // NoAI: das Tier bleibt im Vorgarten stehen und laeuft nicht weg
      const yaw = { north: 180, south: 0, east: -90, west: 90 }[fr.facing];
      const r = pet[0] === 'penguin' ? await summonPenguin(this.mc, x, z, yaw, p.plot, `${p.name}s Pinguin`) : await this.mc.send(`summon ${pet[0]} ${x} ${BASE} ${z} {Tags:["mc_pet","mc_pet_${p.plot}"],PersistenceRequired:1b,NoAI:1b,Invulnerable:1b,Rotation:[${yaw}f,0f],CustomName:${name},CustomNameVisible:1b}`);
      this.log(`[Haustier] ${p.name}: ${pet[0]} -> ${r}`);
      await this.mc.send(`particle minecraft:heart ${x} ${BASE + 1.5} ${z} 0.6 0.4 0.6 0 12 force`);
      await this.mc.send(`particle minecraft:poof ${x} ${BASE + 0.5} ${z} 0.4 0.3 0.4 0.05 20 force`);
      await sleep(4500); // kurz drauf bleiben
    } });
  }

  /** Freundlicher Hinweis, wenn jemand einen Befehl zu schnell wiederholt */
  waitHint(p, what = 'Das') {
    this.game.ack(p, `⏳ ${what} geht gleich wieder – kurz warten`);
    if (this.game.chatReplyReady(p, 30_000)) this.speech.say(pick([`${spoken(p)}, kurz durchatmen! In einer Minute geht das wieder.`, `Moment, ${spoken(p)}, ich bin gleich wieder für dich da!`]));
  }

  cmdParty(p) {
    if (p.plot === null) { this.game.ack(p, '🏠 Erst ein Haus – schreib **Haus**'); return this.speech.say(`${spoken(p)}, ohne Haus keine Party! Schreib Haus!`); }
    if (Date.now() - (this.cooldown.get('party') || 0) < 20_000) return this.game.ack(p, '🎉 Gerade läuft eine Party – gleich nochmal!');
    if (!this.ready('party:' + p.id, 120_000)) return this.waitHint(p, 'Party');
    this.ready('party', 20_000);
    this.game.ack(p, '🎉 Party bei dir startet gleich');
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
