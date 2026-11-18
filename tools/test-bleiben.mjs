// Kurztest ohne Minecraft/TikTok: Dabeibleiben, Bau-Sprint, Countdown, Baustellen-Etappen.
// Aufruf: node tools/test-bleiben.mjs
import { Action } from '../src/action.js';
import { Game } from '../src/game.js';

const out = [];
const broadcast = (m) => out.push(m);
const builder = { mc: { send: async () => {}, sendAll: async () => {} }, queue: [], enqueue(j) { this.queue.push(j); return true; } };
const speech = { say: () => {} };
const store = { data: { players: {}, nextPlot: 0, community: { index: 3, progress: 200, stage: 0 }, totals: { coins: 0, likes: 0 } }, save() {}, get players() { return this.data.players; } };
const game = new Game({ store, builder, speech, config: { points: { likesPerPoint: 50, coinsPerPoint: 1 } }, broadcast, log: () => {} });
game.action = new Action({ game, builder, speech, broadcast, config: {}, log: () => {} });
const a = game.action;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FEHLER ') + t); if (!c) process.exitCode = 1; };

const p = { id: 'u1', name: 'tester', points: 0, level: 1, plot: 5 };
store.data.players.u1 = p;
a.onChat(p, 'hallo');
ok(out.some((m) => m.type === 'ack' && m.text.includes('Bleib')), 'Hinweis beim ersten Mal');
a.seen.set(p.id, Date.now() - 6 * 60_000);
const lv = p.level;
a.onChat(p, 'noch da');
ok(p.level === lv + 1, `Haus eine Stufe hoeher (${lv} -> ${p.level})`);
const lv2 = p.level; a.onChat(p, 'nochmal');
ok(p.level === lv2, 'Bonus nur einmal pro LIVE');

const before = store.data.community.progress;
a.sprint = Date.now() + 30_000; game.addCommunity(10);
ok(store.data.community.progress - before === 20, 'Bau-Sprint zaehlt doppelt');
a.pushGoal();
ok(out.filter((m) => m.type === 'goal').pop().next.includes('BAU-SPRINT'), 'Countdown zeigt Sprint');
a.sprint = null; a.pushGoal();
console.log('     Countdown:', out.filter((m) => m.type === 'goal').pop().next);

builder.queue.length = 0;
game.addCommunity(2500 * 0.35);
ok(builder.queue.some((j) => j.type === 'communityStage'), 'Baustelle waechst bei neuen 10 %: ' + JSON.stringify(builder.queue.map((j) => [j.type, j.from, j.to])));
game.addCommunity(2500);
ok(builder.queue.some((j) => j.type === 'community' && j.partial), 'Fertigbau ohne Abriss der Baustelle');
ok(store.data.community.index === 4 && store.data.community.stage === 0, 'naechstes Projekt beginnt bei 0');
process.exit();
