// Spiel-Logik: Zuschauer, Haeuser, Punkte, Stufen, Bestenliste, Buergermeister-Sprueche.
import { LEVELS, MAX_LEVEL, levelForPoints, pointsForLevel, levelInfo } from './levels.js';
import { COMMUNITY_PROJECTS } from './city.js';

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

    builder.onEvent = (ev) => {
      if (ev.type === 'buildStart') {
        this.broadcast({ type: 'ticker', text: `@${ev.player.name} baut aus: Stufe ${ev.level} · ${levelInfo(ev.level).name}`, highlight: true });
        this.broadcast({ type: 'player', card: this.card(ev.player) });
      }
      if (ev.type === 'buildDone') { ev.player.builtLevel = ev.level; this.store.save(); }
      if (ev.type === 'showHouse') this.broadcast({ type: 'player', card: this.card(ev.player) });
    };

    speech.onStart = (text) => this.broadcast({ type: 'speak', text, on: true });
    speech.onEnd = () => this.broadcast({ type: 'speak', on: false });

    setInterval(() => this.idle(), 25_000); // Buergermeister redet regelmaessig mit den Zuschauern

    this.sessionLikes = new Map(); // Likes je Zuschauer in diesem Stream
    this.likeLog = [];             // fuer "Likes pro Minute"
    setInterval(() => this.likeStats(), 45_000);
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
    return Object.values(this.store.players).filter((p) => p.coins > 0).sort((a, b) => b.coins - a.coins)[0] || null;
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
    if (reason === 'gift') lines.push(`${n} schickt ein Geschenk und bekommt sofort ein Haus!`);
    this.speech.say(pick(lines), true);
    if (Math.random() < 0.5) this.speech.say('Mit Likes und Geschenken baust du es jetzt Stufe für Stufe aus!');
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
    c.progress += up;
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
      }
    }
    this.store.save();
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
    p.coins += coins;
    this.store.data.totals.coins += coins;
    this.claimHouse(p, 'gift');
    this.addPoints(p, coins / this.coinsPerPoint);
    const n = spoken(p);
    this.broadcast({ type: 'banner', title: `DANKE @${p.name}!`, text: `${gift.count > 1 ? gift.count + 'x ' : ''}${gift.name} · +${fmt(coins / this.coinsPerPoint)} UP`, avatar: p.avatar, gift: gift.image, big: coins >= 100 });
    this.broadcast({ type: 'confetti', amount: Math.min(200, 20 + coins) });
    this.broadcast({ type: 'player', card: this.card(p) });
    if (coins < 30) this.speech.say(pick([`Danke für ${gift.name}, ${n}!`, `${n}, danke dir!`, `Ein ${gift.name} von ${n}. Merci!`]));
    else this.speech.say(pick([`Wow, ${n}! Vielen Dank für ${gift.name}!`, `Applaus für ${n}!`, `${n} lässt es krachen! Danke!`]), true);
    // Events bei grossen Geschenken
    this.giftEffect(p, coins);
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
      await this.builder.mc.send('weather thunder');
      await this.builder.camera(0, -30, 45, 0, -50, 0);
      await this.builder.fireworkShow(0, 0, 30, 20);
      await this.builder.mc.send('weather clear');
    } });
  }

  // ---------- Leerlauf: Buergermeister erzaehlt was ----------

  idle() {
    if (this.speech.speaking || this.speech.queue.length || this.builder.busy) return;
    const s = this.state();
    const likesFor2 = pointsForLevel(2) * this.likesPerPoint;
    const lines = [
      'Schreib Haus in den Chat und du bekommst ein eigenes Grundstück in Meme City!',
      `Mit Likes baust du dein Haus aus! ${this.likesPerPoint} Likes sind ein Upgrade-Punkt.`,
      'Jedes Geschenk ist ein Turbo für dein Haus. Ein Coin gleich ein Punkt!',
      `Schon ${fmt(likesFor2)} Likes und deine Hütte wird zur Holzhütte. Tippt mal schön auf den Bildschirm!`,
      'Likes oder Geschenke, beides bringt dein Haus auf die nächste Stufe. Bis hoch zum Königspalast!',
      'Schreib: Zeig mein Haus, dann fliegen wir hin.',
      'Wer will Ehrenbürgermeister werden? Der größte Unterstützer bekommt den Titel!',
      'Wie findet ihr die Stadt bis jetzt? Schreibt es in den Chat!',
      'Folgt dem Kanal, dann bekommt ihr automatisch ein Haus geschenkt!',
      'Teilt den Stream mit Freunden, dann wird Meme City noch größer!',
      `Meme City hat schon ${fmt(s.houses)} Häuser! Fehlt deins noch?`,
      'Ab einer Rose regnet es Herzen, ab einem Donut gibt es Feuerwerk, und beim Universe steigt die große Party!',
    ];
    if (s.top[0]) lines.push(`Platz eins ist gerade ${s.top[0].nick || s.top[0].name} mit Stufe ${s.top[0].level}. Wer holt sich den Thron?`);
    if (s.community) lines.push(`Gemeinschaftsbau ${s.community.name}: ${fmt(s.community.progress)} von ${fmt(s.community.goal)}. Jedes Like und jedes Geschenk zählt mit!`);
    // Jemanden direkt ansprechen, der kurz vor der naechsten Stufe ist
    const close = this.ranking().map((p) => this.card(p)).filter((c) => c.nextLevel && c.progress >= 0.5).sort((a, b) => b.progress - a.progress)[0];
    if (close) lines.push(`${close.nick || close.name}, dir fehlen nur noch ${fmt(close.likesNeeded)} Likes bis zum ${close.nextName}! Wer hilft mit?`);
    this.speech.say(pick(lines));
    this.broadcast({ type: 'ticker', text: pick([
      'Schreib „Haus“ in den Chat und zieh nach Meme City!',
      `❤️ ${this.likesPerPoint} Likes = 1 Upgrade-Punkt · 🎁 1 Coin = 1 Punkt`,
      'Likes und Geschenke bauen dein Haus aus – bis zum Königspalast!',
      'Schreib „Zeig mein Haus“ und die Kamera fliegt hin!',
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
