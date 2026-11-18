// Spiel-Logik: Zuschauer, Haeuser, Punkte, Stufen, Bestenliste, Buergermeister-Sprueche.
import { LEVELS, MAX_LEVEL, levelForPoints, pointsForLevel, levelInfo } from './levels.js';
import { COMMUNITY_PROJECTS, plotCenter, frontOf, BASE as BASE_Y } from './city.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => Math.round(n).toLocaleString('de-DE');

/** Name zum Vorlesen: Emojis und Sonderzeichen raus. */
function spoken(p) {
  const n = (p.nick || p.name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim();
  return n || p.name;
}

export class Game {
  constructor({ store, builder, speech, config, broadcast, log = console.log }) {
    this.store = store;
    this.builder = builder;
    this.speech = speech;
    this.cfg = config;
    this.broadcast = broadcast;
    this.log = log;
    this.mayorName = config.mayorName || 'Bürgermeister Memo';
    this.likesPerPoint = config.points?.likesPerPoint ?? 50;
    this.coinsPerPoint = config.points?.coinsPerPoint ?? 1;
    this.checkedNoHouse = new Set();

    builder.housesProvider = () => this.ranking();
    builder.idleShow = (busy) => this.idleShow(busy);
    builder.onEvent = (ev) => {
      if (ev.type === 'tourHouse') {
        this.broadcast({ type: 'player', card: this.card(ev.player) });
        this.broadcast({ type: 'ticker', text: `🏡 Zu Besuch bei @${ev.player.name}: ${levelInfo(ev.player.level).name}` });
      }
      if (ev.type === 'buildStart') {
        this.broadcast({ type: 'ticker', text: `@${ev.player.name} baut aus: Stufe ${ev.level} · ${levelInfo(ev.level).name}`, highlight: true });
        this.broadcast({ type: 'player', card: this.card(ev.player) });
      }
      if (ev.type === 'buildDone') { ev.player.builtLevel = ev.level; this.store.save(); }
      if (ev.type === 'showHouse') this.broadcast({ type: 'player', card: this.card(ev.player) });
    };

    speech.onStart = (text) => this.broadcast({ type: 'speak', text, on: true });
    speech.onEnd = () => this.broadcast({ type: 'speak', on: false });

    setInterval(() => this.idle(), 60_000); // Buergermeister redet regelmaessig mit den Zuschauern

    this.sessionLikes = new Map(); // Likes je Zuschauer in diesem Stream
    this.likeLog = [];             // fuer "Likes pro Minute"
    setInterval(() => this.likeStats(), 45_000);
    // Chat-Befehle regelmaessig zeigen (versetzt zur Like-Statistik)
    setTimeout(() => { this.broadcast({ type: 'help' }); setInterval(() => this.broadcast({ type: 'help' }), 60_000); }, 20_000);
  }

  /** Blendet ab und zu die Like-Statistik dieses Streams ein. */
  likeStats() {
    const now = Date.now();
    this.likeLog = this.likeLog.filter((l) => now - l.t < 60_000);
    const perMin = this.likeLog.reduce((s, l) => s + l.n, 0);
    const total = [...this.sessionLikes.values()].reduce((s, n) => s + n, 0);
    if (!total) return;
    const top = [...this.sessionLikes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, likes]) => {
      const p = this.store.players[id];
      return { name: p?.name || id, avatar: p?.avatar || '', likes };
    });
    this.broadcast({ type: 'likestats', top, total, perMin, likers: this.sessionLikes.size });
  }

  // ---------- Zuschauer ----------

  /** Zuschauer-Datensatz holen oder anlegen. user = { id, name, nick, avatar } */
  player(user) {
    const id = String(user.name || '').toLowerCase();
    if (!id) return null;
    let p = this.store.players[id];
    if (!p) {
      p = this.store.players[id] = { id, name: user.name, nick: user.nick || user.name, avatar: user.avatar || '', plot: null, level: 1, builtLevel: 0, points: 0, coins: 0, likes: 0, likeRest: 0, joined: Date.now() };
    }
    if (user.nick) p.nick = user.nick;
    if (user.avatar) p.avatar = user.avatar;
    return p;
  }

  get housesCount() { return Object.values(this.store.players).filter((p) => p.plot !== null).length; }

  ranking() {
    return Object.values(this.store.players).filter((p) => p.plot !== null)
      .sort((a, b) => b.points - a.points || a.joined - b.joined);
  }

  rankOf(p) { return this.ranking().indexOf(p) + 1; }

  topSupporter() {
    return this.ranking()[0] || null; // Platz 1 der Stadt (nach Punkten)
  }

  /** Daten fuer die Spieler-Karte im Overlay. */
  card(p) {
    const info = levelInfo(p.level);
    const next = p.level < MAX_LEVEL ? levelInfo(p.level + 1) : null;
    const from = pointsForLevel(p.level), to = next ? pointsForLevel(p.level + 1) : from;
    const missing = Math.max(0, to - p.points);
    return {
      name: p.name, nick: p.nick, avatar: p.avatar, level: p.level, levelName: info.name,
      nextLevel: next ? p.level + 1 : null, nextName: next?.name || null,
      progress: next ? (p.points - from) / (to - from) : 1,
      likesNeeded: Math.max(0, missing * this.likesPerPoint - p.likeRest),
      coinsNeeded: Math.ceil(missing / this.coinsPerPoint),
      rank: this.rankOf(p), houses: this.housesCount, points: p.points, coins: p.coins,
      hasHouse: p.plot !== null,
    };
  }

  state() {
    const top = this.ranking().slice(0, 10).map((p) => ({ name: p.name, nick: p.nick, avatar: p.avatar, level: p.level, levelName: levelInfo(p.level).name, points: p.points }));
    const c = this.store.data.community;
    const proj = COMMUNITY_PROJECTS[c.index] || null;
    const ts = this.topSupporter();
    return {
      city: this.cfg.cityName || 'Meme City',
      mayorName: this.mayorName,
      houses: this.housesCount,
      citizens: Object.keys(this.store.players).length,
      pets: Object.values(this.store.players).reduce((n, p) => n + (p.pet ? 1 : 0) + (p.giftPet ? 1 : 0), 0),
      top,
      honorary: ts ? { name: ts.name, nick: ts.nick, avatar: ts.avatar, coins: ts.coins } : null,
      community: proj ? { name: proj.name, progress: Math.floor(c.progress), goal: proj.goal } : null,
      totals: this.store.data.totals,
      likesPerPoint: this.likesPerPoint,
    };
  }

  pushState() { this.broadcast({ type: 'state', state: this.state() }); }

  // ---------- Haus ----------

  /** Sorgt dafuer, dass immer genug freie Grundstuecke vorbereitet sind. */
  ensureFreePlots() {
    const d = this.store.data;
    const want = this.cfg.freePlots ?? 120;
    if ((d.decoVersion || 0) < 2) { d.preparedUntil = d.nextPlot; d.decoVersion = 2; }
    const from = Math.max(d.preparedUntil || 0, d.nextPlot);
    if (from - d.nextPlot >= want / 2) return;
    const to = d.nextPlot + want;
    d.preparedUntil = to;
    this.store.save();
    this.builder.enqueue({ type: 'fn', fn: () => this.builder.prepareFreePlots(from, to) });
  }

  claimHouse(p, reason = 'chat') {
    if (p.plot !== null) return false;
    p.plot = this.store.data.nextPlot++;
    this.ensureFreePlots();
    p.level = levelForPoints(p.points);
    this.store.save();
    this.builder.enqueue({ type: 'build', player: p });
    const n = spoken(p);
    const lines = [
      `Neuer Eintrag im Grundbuch: ${n}! Willkommen in Meme City.`,
      `${n} zieht ein! Stufe ${p.level}, ${levelInfo(p.level).name}.`,
      `Herzlich willkommen, ${n}. Dein Grundstück ist bereit.`,
      `Grundstück Nummer ${p.plot + 1} geht an ${n}!`,
    ];
    if (reason === 'follow') lines.push(`Danke fürs Folgen, ${n}! Dafür gibt es ein eigenes Haus.`);
    this.speech.say(pick(lines), true);
    if (Math.random() < 0.5) this.speech.say('Schreib zeig mein Haus, dann fliegen wir hin!');
    this.broadcast({ type: 'ticker', text: `Neu in der Stadt: @${p.name} (Grundstück ${p.plot + 1})`, highlight: true });
    this.broadcast({ type: 'player', card: this.card(p) });
    this.pushState();
    return true;
  }

  addPoints(p, up) {
    if (up <= 0) return;
    p.points += up;
    this.addCommunity(up);
    const newLevel = levelForPoints(p.points);
    if (p.plot !== null && newLevel > p.level) {
      p.level = newLevel;
      p._almost = null;
      this.builder.enqueue({ type: 'build', player: p });
      this.pushState();
      const n = spoken(p), name = levelInfo(newLevel).name;
      this.speech.say(pick([
        `Stufe ${newLevel} für ${n}! ${name}!`,
        `${n} auf Stufe ${newLevel}. Willkommen im ${name}.`,
        `Achtung, Baustelle! ${n} baut aus zum ${name}.`,
        `Das gibt's ja nicht! ${n} hat jetzt ein ${name}.`,
        `Bagger los! Stufe ${newLevel} für ${n}.`,
      ]), true);
    } else if (p.plot !== null) {
      p.level = newLevel;
      const c = this.card(p);
      if (c.nextLevel && c.progress >= 0.85 && !p._almost) {
        p._almost = c.nextLevel;
        this.broadcast({ type: 'almost', card: c });
        this.speech.say(`Fast geschafft! ${spoken(p)} steht kurz vor Stufe ${c.nextLevel}. Noch ${fmt(c.likesNeeded)} Likes!`);
      }
      if (p._almost && p._almost !== c.nextLevel) p._almost = null;
    } else {
      p.level = newLevel;
    }
    this.store.save();
  }

  addCommunity(up) {
    const c = this.store.data.community;
    if (!COMMUNITY_PROJECTS[c.index]) return;
    const before = COMMUNITY_PROJECTS[c.index] ? c.progress / COMMUNITY_PROJECTS[c.index].goal : 0;
    c.progress += up;
    // Zwischenstaende feiern
    const cur = COMMUNITY_PROJECTS[c.index];
    if (cur && c.progress < cur.goal) {
      const now = c.progress / cur.goal;
      for (const m of [0.25, 0.5, 0.75, 0.9]) {
        if (before < m && now >= m) {
          const pct = Math.round(m * 100);
          this.speech.say(pct === 90 ? `Fast geschafft! Das ${cur.name} ist zu neunzig Prozent fertig!` : `${pct} Prozent geschafft! Das ${cur.name} wächst!`, true);
          this.broadcast({ type: 'banner', title: `🏗️ ${cur.name.toUpperCase()}: ${pct} %`, text: `${fmt(c.progress)} / ${fmt(cur.goal)} Punkte`, big: pct >= 75 });
        }
      }
    }
    let proj;
    while ((proj = COMMUNITY_PROJECTS[c.index]) && c.progress >= proj.goal) {
      c.progress -= proj.goal;
      const index = c.index++;
      this.builder.enqueue({ type: 'community', index, name: proj.name });
      this.speech.say(`Gemeinsam geschafft! Meme City bekommt ein ${proj.name}! Danke an alle!`, true);
      this.broadcast({ type: 'banner', title: 'GEMEINSCHAFTSBAU!', text: `${proj.name} wird gebaut`, big: true });
    }
  }

  // ---------- Ereignisse von TikTok (oder vom Testpanel) ----------

  onChat(user, text) {
    const p = this.player(user);
    if (!p) return;
    if (this.action?.onChat(p, text)) { this.store.save(); return; }
    const t = text.toLowerCase();
    if (/(zeig|wo ist|wo steht|show)/.test(t) && /(haus|house)/.test(t)) {
      if (p.plot === null) {
        this.speech.say(`${spoken(p)}, du hast noch kein Haus. Schreib einfach Haus in den Chat!`);
      } else {
        this.builder.enqueue({ type: 'camera', player: p });
        this.speech.say(pick([`Kamera ab! Hier wohnt ${spoken(p)}.`, `Bitte schön, das Haus von ${spoken(p)}.`, `Wir fliegen zu ${spoken(p)}!`]));
      }
    } else if (/\b(haus|house)\b/.test(t)) {
      if (!this.claimHouse(p, 'chat')) {
        this.broadcast({ type: 'player', card: this.card(p) });
        if (this.chatReplyReady(p, 20_000)) this.speech.say(pick([`${spoken(p)}, du wohnst schon in Meme City! Schreib zeig mein Haus.`, `${spoken(p)}, dein ${levelInfo(p.level).name} steht schon!`]));
      }
    } else {
      this.replyToChat(p, text);
    }
    this.store.save();
  }

  /** Darf der Buergermeister gerade auf eine Chat-Nachricht antworten? (nicht zu oft, nicht immer derselben Person) */
  chatReplyReady(p, perUser = 45_000) {
    const now = Date.now();
    if (this.speech.queue.length >= 2) return false;
    if (now - (this.lastChatReply || 0) < 8_000) return false;
    if (now - (p._lastReply || 0) < perUser) return false;
    this.lastChatReply = now; p._lastReply = now;
    return true;
  }

  /** Der Buergermeister reagiert auf normale Chat-Nachrichten – so wird der LIVE wirklich interaktiv. */
  replyToChat(p, text) {
    const t = text.toLowerCase().trim();
    const n = spoken(p);
    if (!t || /https?:|www\.|\.com|\.de\b/.test(t)) return; // keine Links vorlesen
    const BAD = /(fick|fuck|hure|nutte|nazi|hitler|schlampe|wichser|hurensohn|missgeburt|arsch|scheiß|scheiss|bitch|nigg|schwuchtel|spast|behindert|töte|kill dich|sex|porn|nackt)/;
    if (BAD.test(t)) return;
    let line = null;
    if (/\b(hi|hallo|hey|moin|servus|hello|huhu|na|guten (tag|abend|morgen)|grüß|gruss|yo)\b/.test(t)) {
      line = p.plot === null
        ? pick([`Hallo ${n}! Willkommen in Meme City. Schreib Haus, dann bekommst du ein Grundstück!`, `Hey ${n}! Schön, dass du da bist. Willst du hier wohnen? Schreib Haus!`])
        : pick([`Hallo ${n}! Dein ${levelInfo(p.level).name} wartet schon auf dich.`, `Hey ${n}, willkommen zurück in Meme City!`]);
    } else if (/(tschüss|tschüß|bye|ciao|gute nacht|bis morgen|bis später|muss los)/.test(t)) {
      line = pick([`Tschüss ${n}, bis zum nächsten Mal!`, `Mach's gut, ${n}! Dein Haus bleibt stehen.`]);
    } else if (/(wie|was|wo|warum|wann|kann man|geht das|funktioniert)/.test(t) && /\?|wie|funktioniert/.test(t)) {
      line = p.plot === null
        ? `${n}, ganz einfach: Schreib Haus in den Chat, dann bekommst du ein eigenes Haus. Mit Likes wird es größer!`
        : pick([`${n}, mit Likes wächst dein Haus. Und schreib zum Beispiel farbe rot oder haustier katze!`, `${n}, gute Frage! Schreib zeig mein Haus, party oder haustier hund, dann passiert was.`]);
    } else if (/(cool|geil|nice|krass|stark|schön|schoen|toll|lustig|lol|haha|xd|wow|mega|beste|liebe)/.test(t)) {
      line = pick([`Danke ${n}, freut mich!`, `${n} findet's gut, das freut den Bürgermeister!`, `Haha, danke ${n}!`]);
    } else if (/(langweilig|blöd|bloed|doof|schlecht|lame)/.test(t)) {
      line = `${n}, dann bau doch mit! Schreib Haus oder party, dann ist hier gleich mehr los.`;
    } else if (t.length >= 3 && t.length <= 70 && Math.random() < 0.35) {
      // sonst ab und zu die Nachricht vorlesen, damit sich jeder gesehen fuehlt
      line = `${n} sagt: ${text.replace(/[^\p{L}\p{N} ,.!?'-]/gu, '').trim()}`;
    }
    if (line && this.chatReplyReady(p)) this.speech.say(line);
  }

  onFollow(user) {
    const p = this.player(user);
    if (!p) return;
    if (!this.claimHouse(p, 'follow')) this.broadcast({ type: 'ticker', text: `Danke fürs Folgen, @${p.name}!` });
  }

  onGift(user, gift) {
    const p = this.player(user);
    if (!p) return;
    const coins = (gift.diamonds || 0) * (gift.count || 1);
    this.log(`[Geschenk] @${p.name}: ${gift.count || 1}x ${gift.name} (${coins} Coins)`);
    this.action?.onGift(p, coins);
    p.coins += coins;
    this.store.data.totals.coins += coins;
    this.claimHouse(p, 'gift');
    this.addPoints(p, coins / this.coinsPerPoint);
    const n = spoken(p);
    this.broadcast({ type: 'banner', title: `DANKE @${p.name}!`, text: `${gift.count > 1 ? gift.count + 'x ' : ''}${gift.name}`, avatar: p.avatar, gift: gift.image, big: coins >= 100 });
    this.broadcast({ type: 'confetti', amount: Math.min(200, 20 + coins) });
    this.broadcast({ type: 'player', card: this.card(p) });
    // Kurzes Danke ohne Geschenknamen und nicht bei jedem Geschenk (TikTok wertet Dauer-Ansagen als Aufforderung)
    if (!this.speech.speaking && !this.speech.queue.length && Math.random() < 0.5) this.speech.say(pick([`Danke, ${n}!`, `${n}, du bist klasse!`, `Merci, ${n}!`]));
    // Events bei grossen Geschenken
    if (this.giftFx) this.giftFx.run(p, gift, coins); else this.giftEffect(p, coins);
    this.pushState();
    this.store.save();
  }

  onLike(user, count) {
    const p = this.player(user);
    if (!p) return;
    p.likes += count;
    this.store.data.totals.likes += count;
    // Like-Statistik fuer diesen Stream
    const before = this.sessionLikes.get(p.id) || 0;
    this.sessionLikes.set(p.id, before + count);
    this.likeLog.push({ t: Date.now(), n: count });
    for (const m of [100, 500, 1000, 2500, 5000, 10000]) {
      if (before < m && before + count >= m) {
        this.broadcast({ type: 'player', card: this.card(p) });
        this.broadcast({ type: 'ticker', text: `❤️ @${p.name} hat heute schon ${fmt(m)} Likes gegeben!`, highlight: true });
        if (m >= 500) this.speech.say(pick([`${fmt(m)} Likes von ${spoken(p)}! Wahnsinn!`, `${spoken(p)} hat schon ${fmt(m)} Likes geschickt. Danke!`]));
      }
    }
    p.likeRest += count;
    const up = Math.floor(p.likeRest / this.likesPerPoint);
    p.likeRest -= up * this.likesPerPoint;
    this.broadcast({ type: 'likes', count, avatar: p.avatar, name: p.name });
    if (up > 0) this.addPoints(p, up);
    this.action?.onLike(p, count);
    // Herzen steigen ueber dem eigenen Haus auf (hoechstens alle 4 Sekunden pro Person)
    if (p.plot !== null && Date.now() - (p._heart || 0) > 4000) {
      p._heart = Date.now();
      const { x, z } = plotCenter(p.plot);
      this.builder.mc.send(`particle minecraft:heart ${x} ${(p.top ?? -50) + 2} ${z} 1.5 0.8 1.5 0 ${Math.min(12, 2 + Math.floor(count / 5))} force`);
    }
    this.thankLiker(p);
    if (p.plot === null && !this.checkedNoHouse.has(p.id) && p.likes >= 30) {
      this.checkedNoHouse.add(p.id);
      this.speech.say(`Kurzer Check: ${spoken(p)} hat noch kein Haus. Schreib Haus in den Chat!`);
    }
    this.store.save();
  }

  /** Sichtbarer Effekt in Minecraft, je nach Groesse des Geschenks (am Stadtplatz). */
  giftEffect(p, coins) {
    const mc = this.builder.mc, b = this.builder;
    if (coins >= 1000) return this.bigEvent(p);
    if (coins >= 100) {
      this.builder.enqueue({ type: 'fn', fn: async () => {
        await b.camera(0, -35, 40, 0, -55, 0);
        await mc.send('particle minecraft:totem_of_undying 0 -52 0 6 4 6 0.6 400 force');
        await b.fireworkShow(0, 0, 12, 12);
      } });
      return;
    }
    if (coins >= 30) {
      b.fireworkShow(0, 0, 5, 8);
      if (p.plot !== null) this.builder.enqueue({ type: 'camera', player: p });
      return;
    }
    if (coins >= 5) {
      b.firework(0, -60, 0);
      mc.send('particle minecraft:happy_villager 0 -56 0 8 3 8 0 120 force');
      return;
    }
    // Kleine Geschenke (Rose & Co.): Herzen ueber dem Platz
    mc.send('particle minecraft:heart 0 -54 0 7 3 7 0 25 force');
    mc.send('playsound minecraft:entity.experience_orb.pickup master @a 0 -55 0 1 1.4');
  }

  bigEvent(p) {
    this.speech.say(`Party in Meme City! Danke ${spoken(p)}!`, true);
    this.broadcast({ type: 'banner', title: 'PARTY!', text: `Gesponsert von @${p.name}`, big: true });
    this.builder.enqueue({ type: 'fn', fn: async () => {
      // kein Gewitter (Regen soll nie kommen)
      await this.builder.camera(0, -30, 45, 0, -50, 0);
      await this.builder.fireworkShow(0, 0, 30, 20);
      await this.builder.mc.send('weather clear');
    } });
  }

  // ---------- Leerlauf: Buergermeister erzaehlt was ----------

  /** Kleine Shows, wenn gerade nichts passiert (vom Drohnenflug aufgerufen). */
  async idleShow(busy) {
    const b = this.builder, fx = this.giftFx;
    const houses = this.ranking();
    const shows = ['spotlight', 'spotlight', 'train', 'plane', 'plazaDisco', 'fireworks', 'nightLights'];
    const show = shows[Math.floor(Math.random() * shows.length)];
    const rnd = houses[Math.floor(Math.random() * houses.length)];
    if (show === 'spotlight' && rnd && fx) {
      // Spotlight auf ein zufaelliges Haus mit einem kleinen Effekt
      const { x, z } = plotCenter(rnd.plot);
      this.broadcast({ type: 'player', card: this.card(rnd) });
      this.broadcast({ type: 'ticker', text: `🔦 Spotlight: das ${levelInfo(rnd.level).name} von @${rnd.name}` });
      // (ohne Ansage – zu viele automatische Saetze wertet TikTok als nicht interaktiv)
      await b.cameraAtPlot(x, z, Math.max((rnd.top ?? BASE_Y + 10) - BASE_Y, 10), false, 3, true);
      if (busy()) return;
      await fx.effect(pick(['sparkle', 'confetti', 'butterfly', 'disco', 'birds']), rnd, false);
      await b.waitIdle(3500, busy);
    } else if ((show === 'train' || show === 'plane') && rnd && fx) {
      const { x, z } = plotCenter(rnd.plot);
      const fr = frontOf(x, z);
      await b.cameraAtPlot(x, z, 14, false, 3, true);
      if (busy()) return;
      if (show === 'train') await fx.vehicle(x, z, fr, 'train');
      else await fx.plane(x, rnd.top ?? BASE_Y + 10, z, fr);
    } else if (show === 'plazaDisco') {
      this.broadcast({ type: 'ticker', text: '🪩 Disco auf dem Stadtplatz!' });
      await b.camera(0, BASE_Y + 12, 30, 0, BASE_Y + 3, 0, 3, true);
      if (busy()) return;
      const cols = ['1.0,0.2,0.4', '0.2,0.9,1.0', '1.0,0.9,0.2', '0.6,1.0,0.3', '0.8,0.4,1.0'];
      for (let i = 0; i < 20 && !busy(); i++) {
        await b.mc.send(`particle minecraft:dust{color:[${cols[i % cols.length]}],scale:3.0} 0 ${BASE_Y + 4} 0 9 3 9 0 90 force`);
        if (i % 2 === 0) await b.mc.send(`playsound minecraft:block.note_block.bass master @a 0 ${BASE_Y} 0 1.5 ${[0.6, 0.8, 1, 0.8][i % 4]}`);
        await new Promise((r) => setTimeout(r, 250));
      }
    } else if (show === 'fireworks') {
      await b.camera(0, BASE_Y + 30, 60, 0, BASE_Y + 12, 0, 3, true);
      if (busy()) return;
      await b.fireworkShow(0, 0, 8, 25);
      await b.waitIdle(2000, busy);
    } else if (show === 'nightLights') {
      // kurz Abend: die Laternen der Stadt leuchten
      this.broadcast({ type: 'ticker', text: '🌙 Abendstimmung in Meme City' });
      await b.mc.send('time set 13000');
      await b.camera(0, BASE_Y + 45, 80, 0, BASE_Y, 0, 4, true);
      await b.fireworkShow(0, 0, 4, 30);
      await b.waitIdle(6000, busy);
      await b.mc.send('time set noon');
    }
  }

  idle() {
    if (this.speech.speaking || this.speech.queue.length || this.builder.busy) return;
    const s = this.state();
    // WICHTIG (TikTok-Richtlinien): Der Buergermeister fordert NIE automatisch zu Geschenken auf.
    // Er erzaehlt von der Stadt, erklaert Chat-Befehle und stellt Fragen. Auf Geschenke reagiert er nur.
    const lines = [
      'Schreib Haus in den Chat und du bekommst ein eigenes Grundstück in Meme City!',
      'Schreib: Zeig mein Haus, dann fliegen wir hin.',
      'Mit farbe rot, farbe blau oder einer anderen Farbe streichst du dein Dach neu!',
      'Schreib haustier katze, hund oder fuchs, dann zieht ein Haustier in deinen Garten.',
      'Schreib party, dann feiern wir bei dir zu Hause!',
      'Wie findet ihr die Stadt bis jetzt? Schreibt es in den Chat!',
      'Seid ihr Team Nord oder Team Süd? Schreibt es in den Chat!',
      'Welches Gebäude soll Meme City als nächstes bekommen? Schreibt eure Ideen!',
      `Meme City hat schon ${fmt(s.houses)} Häuser! Fehlt deins noch?`,
      'Schaut mal, wie die Autos durch die Straßen fahren. Hier ist richtig was los!',
      'Falls ich eure Nachricht übersehen habe, schreibt sie einfach nochmal!',
      'Ich lese euren Chat mit. Wenn ich etwas verpasst habe, schreibt es gern nochmal!',
    ];
    if (s.top[0]) lines.push(`Platz eins ist gerade ${s.top[0].nick || s.top[0].name} mit Stufe ${s.top[0].level}. Respekt!`);
    if (s.community) {
      // Der Gemeinschaftsbau ist das gemeinsame Ziel – darueber redet der Buergermeister am liebsten
      const c = s.community, pct = Math.floor((100 * c.progress) / c.goal), rest = c.goal - c.progress;
      const next = COMMUNITY_PROJECTS[this.store.data.community.index + 1]?.name;
      const commLines = [
        `Unser Gemeinschaftsbau: ${c.name}! Wir stehen bei ${pct} Prozent.`,
        `Noch ${fmt(rest)} Punkte, dann bekommt Meme City ein ${c.name}! Das schaffen wir zusammen.`,
        `Jeder Punkt, den ihr für euer Haus sammelt, zählt auch für das ${c.name} mit.`,
        `Stellt euch vor: Mitten auf dem Stadtplatz steht bald ein ${c.name}. ${fmt(c.progress)} von ${fmt(c.goal)} haben wir schon!`,
        `Wer hat Lust auf ein ${c.name}? Wir sind schon bei ${pct} Prozent!`,
      ];
      if (next) commLines.push(`Nach dem ${c.name} kommt als nächstes ein ${next}. Ich bin schon gespannt!`);
      // doppelt so oft wie andere Saetze
      lines.push(...commLines, ...commLines, ...commLines);
      this.broadcast({ type: 'ticker', text: `🏗️ Gemeinschaftsbau ${c.name}: ${fmt(c.progress)} / ${fmt(c.goal)} (${pct} %)`, highlight: true });
    }
    this.speech.say(pick(lines));
    this.broadcast({ type: 'ticker', text: pick([
      'Schreib „Haus“ in den Chat und zieh nach Meme City!',
      'Schreib „Zeig mein Haus“ und die Kamera fliegt hin!',
      'Chat-Befehle: „farbe rot“ · „haustier katze“ · „party“ · „nord“ / „süd“',
      s.top[0] ? `👑 Platz 1: @${s.top[0].name} (Stufe ${s.top[0].level})` : 'Wer wird Platz 1?',
    ]) });
  }

  /** Zuschauer kommt in den LIVE: ab und zu persoenlich begruessen. */
  onJoin(user) {
    const p = this.player(user);
    if (!p) return;
    const now = Date.now();
    if (now - (this.lastGreet || 0) < 20_000 || this.speech.queue.length) return;
    this.lastGreet = now;
    const n = spoken(p);
    if (p.plot !== null) {
      this.speech.say(pick([`Willkommen zurück, ${n}! Dein ${levelInfo(p.level).name} wartet schon.`, `Da ist ja ${n}! Schön, dass du wieder da bist.`]));
    } else {
      this.speech.say(pick([`Hallo ${n}! Schreib Haus in den Chat, dann bekommst du ein Grundstück.`, `Willkommen in Meme City, ${n}! Willst du hier wohnen? Schreib einfach Haus.`, `Hey ${n}! Hier baut jeder sein eigenes Haus. Schreib Haus in den Chat!`]));
    }
  }

  onShare(user) {
    const p = this.player(user);
    if (!p) return;
    this.broadcast({ type: 'ticker', text: `📣 Danke fürs Teilen, @${p.name}!`, highlight: true });
    if (!this.speech.queue.length) this.speech.say(`Danke fürs Teilen, ${spoken(p)}! So wächst die Stadt.`);
  }

  /** Bedankt sich ab und zu bei aktiven Likern (nicht bei jedem Like). */
  thankLiker(p) {
    const now = Date.now();
    if (now - (this.lastLikeThanks || 0) < 30_000 || this.speech.speaking || this.speech.queue.length) return;
    this.lastLikeThanks = now;
    const c = this.card(p), n = spoken(p);
    const lines = [`Danke für die Likes, ${n}!`, `${n} tippt wie verrückt! Weiter so!`];
    if (c.hasHouse && c.nextLevel) lines.push(`${n}, noch ${fmt(c.likesNeeded)} Likes und dein Haus wird zum ${c.nextName}!`);
    if (!c.hasHouse) lines.push(`${n}, danke für die Likes! Schreib Haus, dann zählen sie für dein eigenes Haus.`);
    this.speech.say(pick(lines));
  }
}

export { LEVELS };
