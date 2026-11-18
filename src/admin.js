// Admin-Panel (public/admin.html): Steuerung waehrend des LIVE.
// Nur vom eigenen PC aus erreichbar (localhost), damit niemand im WLAN mitspielt.
import fs from 'fs';
import path from 'path';

export function adminRoutes(app, { game, builder, speech, broadcast, mc, music, tiktok, store, root }) {
  const local = (req, res, next) => {
    const ip = req.socket.remoteAddress || '';
    if (/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) return next();
    res.status(403).json({ error: 'nur am eigenen PC' });
  };
  const A = (p, fn) => app.post('/api/admin/' + p, local, async (req, res) => {
    try { res.json({ ok: true, ...(await fn(req.body || {}, req)) }); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  const player = (name) => {
    const p = store.players[String(name || '').toLowerCase().replace(/^@/, '').trim()];
    if (!p) throw new Error('Spieler nicht gefunden');
    return p;
  };
  const act = game.action;

  // ---------- Buergermeister & Overlay ----------
  A('say', (b) => { speech.say(String(b.text || '').slice(0, 400), true); });
  A('banner', (b) => { broadcast({ type: 'banner', title: String(b.title || ''), text: String(b.text || ''), big: !!b.big }); });
  A('ticker', (b) => { broadcast({ type: 'ticker', text: String(b.text || ''), highlight: true }); });
  A('confetti', () => { broadcast({ type: 'confetti', amount: 200 }); });
  A('overlay-reload', () => { broadcast({ type: 'hello', version: 'r' + Date.now() }); });
  A('pause', (b) => { broadcast({ type: 'pause', on: !!b.on, text: String(b.text || 'Kurze Pause – gleich geht es weiter!') }); });

  // ---------- Spielablauf ----------
  A('start/:what', (b, req) => {
    const w = req.params.what;
    if (act.duel || act.vote || act.raffle) throw new Error('Gerade läuft schon Duell oder Abstimmung');
    if (w === 'vote') act.startVote();
    else if (w === 'duel') act.startDuel();
    else if (w === 'sprint') { if (act.sprint) throw new Error('Bau-Sprint läuft schon'); act.startSprint(); }
    else if (w === 'loyalty') act.loyaltyBonus();
    else throw new Error('unbekannt');
  });
  A('event/:name', (b, req) => { builder.enqueue({ type: 'fn', fn: () => act.runEvent(req.params.name) }); });
  A('show/:name', (b, req) => { builder.nextShow = req.params.name; });
  A('zoo', () => { game.zooTourCmd({ name: 'Admin', avatar: '' }, true); });

  // ---------- Kamera ----------
  A('camera/overview', () => { builder.enqueue({ type: 'fn', fn: async () => { await builder.cameraOverview(); await new Promise((r) => setTimeout(r, 6000)); } }); });
  A('camera/player', (b) => { const p = player(b.name); if (p.plot === null) throw new Error('hat kein Haus'); builder.enqueue({ type: 'camera', player: p }); return { name: p.name }; });
  A('camera/fix', async () => {
    const n = game.cfg?.minecraftName || 'Larscraft17';
    for (const c of [`gamemode creative ${n}`, `gamemode spectator ${n}`, `spectate @e[tag=mc_cam,limit=1] ${n}`]) await mc.send(c);
  });

  // ---------- Zuschauer ----------
  A('points', (b) => { const p = player(b.name), n = Math.max(-1000, Math.min(1000, Number(b.points) || 0)); if (n > 0) game.addPoints(p, n); game.pushState(); return { name: p.name, points: p.points, level: p.level }; });
  A('house', (b) => { const p = player(b.name); if (!game.claimHouse(p, 'chat')) throw new Error('hat schon ein Haus'); return { plot: p.plot + 1 }; });
  A('rebuild', (b) => { const p = player(b.name); if (p.plot === null) throw new Error('hat kein Haus'); builder.enqueue({ type: 'build', player: p, instant: true }); });
  A('chat-as', (b) => { const name = String(b.name || 'testzuschauer'); game.duringChat(() => game.onChat({ name, nick: name, avatar: '' }, String(b.text || ''))); });

  // ---------- Bauen ----------
  A('bonus/:name', (b, req) => { if (!game.buildBonus(req.params.name)) throw new Error('kein Bauplatz frei'); });

  // ---------- Welt ----------
  A('time/:t', async (b, req) => { const t = { tag: 'noon', abend: '13000', nacht: 'midnight', morgen: '0' }[req.params.t]; if (!t) throw new Error('unbekannt'); await mc.send(`time set ${t}`); });
  A('weather/:w', async (b, req) => { const w = { klar: 'clear', regen: 'rain', gewitter: 'thunder' }[req.params.w]; if (!w) throw new Error('unbekannt'); await mc.send(`weather ${w} 6000`); });
  A('mc', async (b) => { const c = String(b.cmd || '').replace(/^\//, '').trim(); if (!c) throw new Error('leer'); return { reply: await mc.send(c) }; });

  // ---------- Musik ----------
  A('music', (b) => {
    if (!music) throw new Error('Musik aus');
    if (b.volume !== undefined) music.volume = Math.max(0, Math.min(1, Number(b.volume)));
    if (b.hype !== undefined) music.hype(!!b.hype); else music.duck(!!music.ducked);
    return { volume: music.volume };
  });

  // ---------- TikTok ----------
  A('tiktok/reconnect', async () => { await tiktok.disconnect().catch(() => {}); tiktok.connect(); });

  // ---------- Status ----------
  app.get('/api/admin/status', local, (req, res) => {
    const tail = (f, n) => { try { return fs.readFileSync(path.join(root, 'data', f), 'utf8').trim().split('\n').slice(-n); } catch { return []; } };
    res.json({
      tiktok: tiktok.status, minecraft: mc.connected, houses: game.state().houses, community: game.state().community,
      queue: builder.queue.length, busy: builder.busy,
      duel: !!act.duel, vote: !!act.vote, sprint: !!act.sprint,
      next: { duel: act.nextDuelAt, vote: act.nextRaffleAt, sprint: act.nextSprintAt },
      likes: act.sessionLikes, music: music ? { volume: music.volume, hype: !!music.hyped } : null,
      active: [...act.active.entries()].filter(([, t]) => Date.now() - t < 5 * 60_000).length,
      chat: tail('chat.log', 40), log: tail('game.log', 40).filter((l) => !/\[TikTok\] (verbinde|Fehler)/.test(l)),
    });
  });
  app.get('/api/admin/players', local, (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    res.json(Object.values(store.players).filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => b.points - a.points).slice(0, 15).map((p) => ({ name: p.name, points: Math.floor(p.points), level: p.level, plot: p.plot === null ? null : p.plot + 1, likes: p.likes })));
  });
}
