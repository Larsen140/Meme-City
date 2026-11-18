// Startpunkt: verbindet Minecraft, TikTok, Overlay und Testpanel.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Minecraft } from './minecraft.js';
import { Builder } from './builder.js';
import { Speech } from './speech.js';
import { Store } from './store.js';
import { Game } from './game.js';
import { TikTok } from './tiktok.js';
import { CityLife } from './life.js';
import { Music } from './music.js';
import { Action } from './action.js';
import { GiftFx } from './giftfx.js';
import { keepAwake } from './keepawake.js';
import { plotCenter, roadCommands, lampCommands } from './city.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
// Protokoll: im Fenster und zusaetzlich in data/game.log (wird bei 5 MB neu begonnen)
const logFile = path.join(root, 'data', 'game.log');
const log = (...a) => {
  const line = [new Date().toLocaleTimeString('de-DE'), ...a].join(' ');
  console.log(line);
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 5e6) fs.renameSync(logFile, logFile + '.alt');
    fs.appendFileSync(logFile, line + '\n');
  } catch {}
};

// ---------- Overlay-Verbindungen ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(root, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const broadcast = (msg) => {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) {
    // langsamen Empfaengern (Overlay haengt gerade) unwichtige Meldungen nicht weiter aufstauen
    if (c.readyState !== 1) continue;
    if (c.bufferedAmount > 64 * 1024 && (msg.type === 'likes' || msg.type === 'goal' || msg.type === 'duel' || msg.type === 'raffle')) continue;
    c.send(s);
  }
};

// ---------- Teile zusammenbauen ----------
const mc = new Minecraft(config.rcon, log);
const builder = new Builder(mc, config.minecraftName, log);
const speech = new Speech({
  voice: config.voice, rate: config.voiceRate, pitch: config.voicePitch, volume: config.voiceVolume ?? 1,
  enabled: config.speech !== false, dir: path.join(root, 'data', 'tts'),
}, log);

// Minecraft-Skin des Streamers fuer den Buergermeister im Overlay (wird zwischengespeichert)
const skinFile = path.join(root, 'data', 'skin.png');
app.get('/skin.png', async (req, res) => {
  try {
    const stale = !fs.existsSync(skinFile) || Date.now() - fs.statSync(skinFile).mtimeMs > 6 * 3600_000;
    if (stale) {
      const r = await fetch(`https://mc-heads.net/skin/${encodeURIComponent(config.mayorSkin || config.minecraftName)}`);
      if (r.ok) fs.writeFileSync(skinFile, Buffer.from(await r.arrayBuffer()));
    }
  } catch {}
  if (fs.existsSync(skinFile)) res.sendFile(skinFile); else res.status(404).end();
});
const store = new Store(path.join(root, 'data', 'save.json'));
const game = new Game({ store, builder, speech, config, broadcast, log });
const tiktok = new TikTok(config.tiktokName, game, log);
game.action = new Action({ game, builder, speech, broadcast, config, log });
game.giftFx = new GiftFx({ game, builder, speech, broadcast, log });
if (config.keepAwake !== false) keepAwake(log);

// Hintergrundmusik, beim Sprechen des Buergermeisters leiser
const music = new Music({
  file: path.join(root, 'assets', 'musik', 'meme-city.wav'), dataDir: path.join(root, 'data'),
  volume: config.musicVolume ?? 0.2, duckVolume: config.musicDuckVolume ?? 0.06, enabled: config.music !== false,
}, log);
const speakStart = speech.onStart, speakEnd = speech.onEnd;
speech.onStart = (t) => { music.duck(true); speakStart(t); };
speech.onEnd = (t) => { music.duck(false); speakEnd(t); };

// Stimme NUR, wenn der Buergermeister direkt einem Zuschauer antwortet, der gerade geschrieben hat.
// Alles andere (Ansagen, Danke, Events) erscheint nur als Sprechblase ohne Ton.
// Grund: TikTok sperrt LIVEs mit automatischer Computerstimme ohne Bezug zum Chat.
const voiceSay = speech.say.bind(speech);
let chatReply = false;
let silentTimer = null;
game.duringChat = (fn) => { chatReply = true; try { fn(); } finally { chatReply = false; } };
speech.say = (text, prio) => {
  if (!text) return;
  if (chatReply || config.voiceAlways) return voiceSay(text, prio);
  if (speech.speaking) return; // gerade echte Antwort -> nicht dazwischenfunken
  broadcast({ type: 'speak', text, on: true, silent: true });
  clearTimeout(silentTimer);
  silentTimer = setTimeout(() => broadcast({ type: 'speak', on: false }), 3500 + text.length * 45);
};
tiktok.onStatus = (s) => broadcast({ type: 'tiktok', status: s });

const VERSION = String(Date.now()); // aendert sich bei jedem Neustart -> Overlay laedt sich selbst neu
wss.on('connection', (ws) => {
  ws.on('message', (m) => { try { const d = JSON.parse(m); if (d.type === 'diag') fs.appendFileSync(path.join(root, 'data', 'overlay-diag.log'), new Date().toLocaleTimeString('de-DE') + ' ' + JSON.stringify(d) + String.fromCharCode(10)); } catch {} });
  ws.send(JSON.stringify({ type: 'hello', version: VERSION }));
  ws.send(JSON.stringify({ type: 'state', state: game.state() }));
  ws.send(JSON.stringify({ type: 'tiktok', status: tiktok.status }));
  ws.send(JSON.stringify({ type: 'mc', connected: mc.connected }));
  if (pauseState.on) ws.send(JSON.stringify({ type: 'pause', ...pauseState }));
});

// ---------- API fuers Testpanel ----------
const GIFTS = {
  rose: { name: 'Rose', diamonds: 1 },
  donut: { name: 'Donut', diamonds: 30 },
  herz: { name: 'Herz-Hände', diamonds: 100 },
  universe: { name: 'TikTok Universe', diamonds: 1000 },
};
const testUser = (b) => ({ name: String(b.user || 'testzuschauer').replace(/^@/, '').trim(), nick: b.nick || b.user, avatar: b.avatar || '' });

app.post('/api/sim/chat', (req, res) => { game.duringChat(() => game.onChat(testUser(req.body), String(req.body.text || ''))); res.json({ ok: true }); });
app.post('/api/sim/like', (req, res) => { game.onLike(testUser(req.body), Number(req.body.count) || 1); res.json({ ok: true }); });
app.post('/api/sim/follow', (req, res) => { game.onFollow(testUser(req.body)); res.json({ ok: true }); });
app.post('/api/sim/gift', (req, res) => {
  const g = GIFTS[req.body.gift] || GIFTS.rose;
  game.onGift(testUser(req.body), { ...g, count: Number(req.body.count) || 1 });
  res.json({ ok: true });
});
let pauseState = { on: false, text: '' };
app.post('/api/pause', (req, res) => { pauseState = { on: !!req.body.on, text: String(req.body.text || 'Kurze Umbaupause') }; broadcast({ type: 'pause', ...pauseState }); res.json({ ok: true }); });
app.post('/api/say', (req, res) => { speech.say(String(req.body.text || ''), true); res.json({ ok: true }); });
app.post('/api/tiktok/connect', async (req, res) => { tiktok.connect(); res.json({ ok: true }); });
app.post('/api/tiktok/disconnect', async (req, res) => { await tiktok.disconnect(); res.json({ ok: true }); });
app.post('/api/camera/overview', (req, res) => { builder.cameraOverview(); res.json({ ok: true }); });
// Freie Grundstuecke von..bis (neu) vorbereiten, z. B. {from:120,to:170}
app.post('/api/prepare', (req, res) => {
  const from = Number(req.body.from), to = Number(req.body.to);
  if (!(from >= store.data.nextPlot && to > from && to - from <= 100)) return res.status(400).json({ error: 'ungueltig' });
  if (to > (store.data.preparedUntil || 0)) { store.data.preparedUntil = to; store.save(); }
  builder.enqueue({ type: 'fn', fn: () => builder.prepareFreePlots(from, to) });
  res.json({ ok: true });
});
// Test: bestimmte Leerlauf-Show abspielen (spotlight, train, plane, windmill, pyramid, ...)
app.post('/api/show/:name', (req, res) => { builder.nextShow = req.params.name; res.json({ ok: true }); }); // laeuft als naechste Leerlauf-Show (nie parallel zur Kamera)
app.post('/api/rebuild', (req, res) => {
  // Alle Haeuser neu setzen (z. B. nach neuer Welt), ohne Animation
  builder.enqueue({ type: 'fn', fn: () => builder.setupWorld() });
  for (const p of Object.values(store.players)) if (p.plot !== null) builder.enqueue({ type: 'build', player: p, instant: true });
  res.json({ ok: true });
});
// Kameraflug fuers TikTok-Video (Antwort kommt, wenn der Flug fertig ist, mit Start-/Endzeit)
app.post('/api/showcase', (req, res) => {
  const shots = req.body.shots || [];
  builder.enqueue({ type: 'fn', fn: async () => {
    const startedAt = Date.now();
    for (const s of shots) {
      if (s.firework) builder.fireworkShow(0, 0, 14, 14);
      await builder.camera(s.x, s.y, s.z, s.lx, s.ly, s.lz, s.sec);
      if (s.hold) await new Promise((r) => setTimeout(r, s.hold * 1000));
    }
    res.json({ startedAt, endedAt: Date.now() });
  } });
});
// Event von Hand ausloesen (Testpanel): Tornado, Meteorregen, Feuerwerk-Show, Regenbogen, Schneesturm, Party
app.post('/api/bonus/:name', (req, res) => res.json({ ok: game.buildBonus(req.params.name) }));
app.post('/api/event/:name', (req, res) => { builder.enqueue({ type: 'fn', fn: () => game.action.runEvent(req.params.name) }); res.json({ ok: true }); });
app.post('/api/css', (req, res) => { broadcast({ type: 'css', css: String(req.body.css || '') }); res.json({ ok: true }); });
app.post('/api/hidesel', (req, res) => { broadcast({ type: 'hidesel', sel: String(req.body.sel || '') }); res.json({ ok: true }); });
app.post('/api/bare', (req, res) => { broadcast({ type: 'bare', on: !!req.body.on }); res.json({ ok: true }); });
app.get('/api/state', (req, res) => res.json({ ...game.state(), tiktok: tiktok.status, minecraft: mc.connected }));
app.get('/api/player/:name', (req, res) => {
  const p = store.players[req.params.name.toLowerCase().replace(/^@/, '')];
  if (!p) return res.status(404).json({ error: 'nicht gefunden' });
  res.json(game.card(p));
});

// ---------- Start ----------
server.listen(config.webPort || 3000, async () => {
  const port = config.webPort || 3000;
  log(`Meme City läuft!`);
  log(`  Overlay:    http://localhost:${port}/overlay.html`);
  log(`  Testpanel:  http://localhost:${port}/panel.html`);
  // Minecraft verbinden (wartet, bis der Server bereit ist)
  for (let i = 0; ; i++) {
    try { await mc.connect(); break; } catch { if (i === 0) log('[MC] Warte auf Minecraft-Server ... (start-server.bat schon gestartet?)'); await new Promise((r) => setTimeout(r, 5000)); }
  }
  await builder.setupWorld();
  await builder.cameraOverview();
  // Gehwege und Laternen auch an schon bebauten Grundstuecken nachruesten
  if ((store.data.decoVersion || 0) < 2) {
    builder.enqueue({ type: 'fn', fn: async () => {
      for (let n = 0; n < store.data.nextPlot; n++) {
        const { x, z } = plotCenter(n);
        await mc.send(`forceload add ${x - 12} ${z - 12} ${x + 12} ${z + 12}`);
        await mc.sendAll([...roadCommands(x, z), ...lampCommands(x, z)]);
        await mc.send(`forceload remove ${x - 12} ${z - 12} ${x + 12} ${z + 12}`);
      }
    } });
  }
  // Kran-/Geruestreste von unterbrochenen Bauten wegraeumen
  builder.enqueue({ type: 'fn', fn: () => builder.cleanupScaffolds(Object.values(store.players)) });
  // Haeuser, deren Bau unterbrochen wurde (oder nie startete), fertig bauen
  for (const p of Object.values(store.players)) {
    if (p.plot !== null && (p.builtLevel || 0) < p.level) builder.enqueue({ type: 'build', player: p, instant: true });
  }
  // zeitweise Geschenk-Effekte (Hut, Regenbogen, Voegel ...) aufraeumen, falls ein Neustart dazwischen kam
  mc.send('kill @e[tag=mc_gift_tmp]');
  game.ensureFreePlots();
  game.giftFx.checkCrown(); // Krone fuer den aktuellen Ehrenbuergermeister
  const life = new CityLife(mc, { people: config.people ?? 40 }, log);
  life.start(store);
  broadcast({ type: 'mc', connected: true });
  if (config.autoConnectTikTok !== false) tiktok.connect();
});

process.on('SIGINT', () => { store.saveNow(); process.exit(0); });
// Einzelne Fehler sollen nie das ganze Programm beenden
process.on('uncaughtException', (e) => log('[Fehler] ' + (e?.stack || e)));
process.on('unhandledRejection', (e) => log('[Fehler] ' + (e?.stack || e)));
