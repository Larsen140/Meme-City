// Verbindung zum TikTok LIVE. Braucht keinen Login: es liest den oeffentlichen LIVE mit.
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

function userOf(data) {
  const u = data?.user || {};
  const name = u.uniqueId ?? u.displayId ?? u.nickname ?? '';
  const avatar = u.avatarThumb?.urlList?.[0] ?? u.profilePicture?.urls?.[0] ?? u.profilePictureUrl ?? '';
  return { id: String(u.userId ?? u.id ?? name), name: String(name), nick: String(u.nickname ?? name), avatar };
}

export class TikTok {
  constructor(username, game, log = console.log) {
    this.username = username;
    this.game = game;
    this.log = log;
    this.conn = null;
    this.status = 'getrennt';
    this.onStatus = () => {};
    this.retry = null;
    this.connected = false;
    this.connecting = false;
    this.manualOff = false;
    this.lastEvent = Date.now();
    this.seen = new Map(); // Nachrichten-ID -> Zeit, damit jede Nachricht nur einmal zaehlt
    this.connectedAt = 0;
    // Waechter: haelt die Verbindung am Leben, egal was passiert
    setInterval(() => this.watchdog(), 15_000);
  }

  watchdog() {
    if (this.manualOff || this.connecting) return;
    if (!this.connected) {
      if (!this.retryPending) this.connect();
      return;
    }
    // Verbunden, aber seit Minuten kein einziges Ereignis -> Verbindung haengt vermutlich
    if (Date.now() - this.lastEvent > 4 * 60_000) {
      this.log('[TikTok] Seit 4 Minuten keine Ereignisse – verbinde neu');
      this.connect();
    }
  }

  /** true, wenn diese Nachricht schon verarbeitet wurde oder von vor dem Verbinden stammt. */
  isOld(d, text) {
    const now = Date.now();
    let created = Number(d.common?.createTime ?? d.createTime ?? 0);
    if (created && created < 1e12) created *= 1000; // manchmal in Sekunden
    if (created > now + 60_000) created = 0;        // unplausibel -> ignorieren
    if (created && this.connectedAt && created < this.connectedAt - 3000) return true; // alte Nachricht aus dem Verlauf
    const u = userOf(d).name;
    const key = String(d.common?.msgId ?? d.msgId ?? '') || `${u}|${text}|${created}`;
    if (this.seen.has(key)) return true;
    // gleicher Text vom gleichen Nutzer innerhalb von 20 s ebenfalls nur einmal
    const dupKey = `${u}|${text.toLowerCase().trim()}`;
    if (now - (this.seen.get(dupKey) || 0) < 20_000) return true;
    this.seen.set(key, now); this.seen.set(dupKey, now);
    if (this.seen.size > 5000) for (const [k, t] of this.seen) if (now - t > 30 * 60_000) this.seen.delete(k);
    return false;
  }

  scheduleRetry(ms) {
    clearTimeout(this.retry);
    this.retryPending = true;
    this.retry = setTimeout(() => { this.retryPending = false; this.connect(); }, ms);
  }

  setStatus(s) { this.status = s; this.onStatus(s); this.log('[TikTok] ' + s); }

  async connect() {
    if (this.connecting) return;
    this.connecting = true;
    this.manualOff = false;
    clearTimeout(this.retry); this.retryPending = false;
    this.connected = false;
    const old = this.conn; this.conn = null;
    if (old) { try { await old.disconnect(); } catch {} }
    const c = new TikTokLiveConnection(this.username, { processInitialData: false, enableExtendedGiftInfo: false });
    this.conn = c;
    this.setStatus('verbinde ...');
    // jedes Ereignis zaehlt als Lebenszeichen
    c.on(ControlEvent.DECODED_DATA ?? 'decodedData', () => { this.lastEvent = Date.now(); });
    for (const ev of [WebcastEvent.CHAT, WebcastEvent.LIKE, WebcastEvent.MEMBER, WebcastEvent.GIFT, WebcastEvent.ROOM_USER, WebcastEvent.SOCIAL]) c.on(ev, () => { this.lastEvent = Date.now(); });

    c.on(WebcastEvent.CHAT, (d) => this.safe(() => {
      if (this.isOld(d, String(d.comment ?? d.content ?? ''))) return;
      const run = () => this.game.onChat(userOf(d), String(d.comment ?? d.content ?? ''));
      if (this.game.duringChat) this.game.duringChat(run); else run();
    }));
    // Reaktionen auf Zuschauer (Likes, Beitreten, Teilen, Folgen) duerfen laut gesprochen werden – Geschenke nicht
    const react = (fn) => (this.game.duringChat ? this.game.duringChat(fn) : fn());
    c.on(WebcastEvent.LIKE, (d) => this.safe(() => react(() => this.game.onLike(userOf(d), Number(d.likeCount ?? d.count ?? 1)))));
    c.on(WebcastEvent.MEMBER, (d) => this.safe(() => react(() => this.game.onJoin(userOf(d)))));
    c.on(WebcastEvent.SHARE, (d) => this.safe(() => react(() => this.game.onShare(userOf(d)))));
    c.on(WebcastEvent.FOLLOW, (d) => this.safe(() => react(() => this.game.onFollow(userOf(d)))));
    c.on(WebcastEvent.GIFT, (d) => this.safe(() => {
      const g = d.gift || d.giftDetails || {};
      const type = g.type ?? d.giftType;
      // Serien-Geschenke (type 1) erst am Ende der Serie zaehlen
      if (type === 1 && !d.repeatEnd) return;
      this.game.onGift(userOf(d), {
        name: g.name ?? g.giftName ?? d.giftName ?? 'Geschenk',
        diamonds: Number(g.diamondCount ?? d.diamondCount ?? 0),
        count: Number(d.repeatCount || 1),
        image: g.image?.urlList?.[0] ?? g.icon?.urlList?.[0] ?? '',
      });
    }));
    c.on(WebcastEvent.STREAM_END, () => {
      if (this.conn !== c) return;
      this.connected = false;
      this.setStatus('LIVE beendet – warte auf neuen LIVE');
      this.scheduleRetry(30_000);
    });
    c.on(ControlEvent.DISCONNECTED, () => {
      if (this.conn !== c || this.manualOff) return;
      this.connected = false;
      this.setStatus('getrennt – verbinde in 10 s neu');
      this.scheduleRetry(10_000);
    });
    c.on(ControlEvent.ERROR, (e) => this.log('[TikTok] Fehler: ' + String(e?.message || e).slice(0, 160)));

    try {
      const state = await c.connect();
      this.connected = true;
      this.lastEvent = Date.now();
      this.connectedAt = Date.now();
      this.setStatus(`verbunden mit @${this.username} (Raum ${state?.roomId ?? '?'})`);
    } catch (e) {
      const msg = String(e?.message || e);
      this.setStatus(/offline|not.*live|UserOffline|Room ID/i.test(msg) ? `@${this.username} ist gerade nicht LIVE` : 'Fehler: ' + msg.slice(0, 160));
      if (this.conn === c) this.scheduleRetry(20_000);
    } finally {
      this.connecting = false;
    }
  }

  async disconnect() {
    this.manualOff = true;
    this.connected = false;
    clearTimeout(this.retry); this.retryPending = false;
    const c = this.conn; this.conn = null;
    if (c) { try { await c.disconnect(); } catch {} }
    this.setStatus('getrennt');
  }

  safe(fn) { try { fn(); } catch (e) { this.log('[TikTok] Fehler bei Ereignis: ' + e.message); } }
}
