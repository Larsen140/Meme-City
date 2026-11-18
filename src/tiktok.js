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
  }

  setStatus(s) { this.status = s; this.onStatus(s); this.log('[TikTok] ' + s); }

  async connect() {
    clearTimeout(this.retry);
    if (this.conn) { try { await this.conn.disconnect(); } catch {} }
    const c = new TikTokLiveConnection(this.username, { processInitialData: false, enableExtendedGiftInfo: false });
    this.conn = c;
    this.setStatus('verbinde ...');

    c.on(WebcastEvent.CHAT, (d) => this.safe(() => this.game.onChat(userOf(d), String(d.comment ?? d.content ?? ''))));
    c.on(WebcastEvent.LIKE, (d) => this.safe(() => this.game.onLike(userOf(d), Number(d.likeCount ?? d.count ?? 1))));
    c.on(WebcastEvent.FOLLOW, (d) => this.safe(() => this.game.onFollow(userOf(d))));
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
    c.on(WebcastEvent.STREAM_END, () => { this.setStatus('LIVE beendet'); });
    c.on(ControlEvent.DISCONNECTED, () => {
      if (this.conn !== c) return;
      this.setStatus('getrennt – neuer Versuch in 30 s');
      this.retry = setTimeout(() => this.connect(), 30_000);
    });

    try {
      const state = await c.connect();
      this.setStatus(`verbunden mit @${this.username} (Raum ${state?.roomId ?? '?'})`);
    } catch (e) {
      const msg = String(e?.message || e);
      this.setStatus(/offline|not.*live|UserOffline|Room ID/i.test(msg) ? `@${this.username} ist gerade nicht LIVE` : 'Fehler: ' + msg.slice(0, 160));
      if (this.conn === c) this.retry = setTimeout(() => this.connect(), 60_000);
    }
  }

  async disconnect() {
    clearTimeout(this.retry);
    const c = this.conn; this.conn = null;
    if (c) { try { await c.disconnect(); } catch {} }
    this.setStatus('getrennt');
  }

  safe(fn) { try { fn(); } catch (e) { this.log('[TikTok] Fehler bei Ereignis: ' + e.message); } }
}
