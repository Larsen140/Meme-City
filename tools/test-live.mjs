// Test gegen das laufende Spielprogramm (nur wenn NICHT live!): schickt Testnachrichten
// und prueft, ob im Overlay eine Antwort erscheint. Baut kein Haus.
// Aufruf: node tools/test-live.mjs
import WebSocket from 'ws';
const base = 'http://localhost:3000';
const st = await (await fetch(base + '/api/state')).json();
if (/verbunden/i.test(String(st.tiktok)) && !/fehler|nicht/i.test(String(st.tiktok))) { console.log('LIVE läuft – kein Test!'); process.exit(1); }

const msgs = [];
const ws = new WebSocket(base.replace('http', 'ws'));
ws.on('message', (d) => { try { msgs.push(JSON.parse(d)); } catch {} });
await new Promise((r) => ws.on('open', r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const user = 'testzuschauer';
const chat = (text) => fetch(base + '/api/sim/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, text }) });
let fails = 0;
const ok = (c, t) => { console.log((c ? 'OK     ' : 'FEHLER ') + t); if (!c) fails++; };

const cases = [
  ['farbe rot', /Erst ein Haus/],
  ['haustier pinguin', /Erst ein Haus/],
  ['haustier löwe', /Erst ein Haus/],
  ['party', /Erst ein Haus/],
  ['auto rot', /Erst ein Haus/],
  ['nord', /NORD/],
  ['süd', /SÜD/],
  ['zeig mein haus', /.+/],
];
for (const [text, re] of cases) {
  msgs.length = 0;
  await chat(text);
  await wait(800);
  const a = msgs.filter((m) => m.type === 'ack' && m.name === user).map((m) => m.text);
  ok(a.some((t) => re.test(t)), `„${text}“ → ${a[0] ?? '(keine Antwort im Overlay)'}`);
}
// Frage an den Buergermeister
msgs.length = 0; await chat('wie bekomme ich ein haustier?'); await wait(1500);
ok(msgs.some((m) => m.name === user || m.type === 'say' || m.type === 'mayor' || m.type === 'ack'), 'Frage wird beantwortet (' + (msgs.map((m) => m.type).join(',') || 'nichts') + ')');
// Countdown in der Ziel-Leiste
msgs.length = 0; await wait(5500);
const g = msgs.filter((m) => m.type === 'goal').pop();
// Waehrend Duell, Abstimmung oder Verlosung zeigt die Leiste deren Stand statt des Countdowns
const busy = msgs.find((m) => ['duel', 'vote', 'raffle'].includes(m.type));
ok((g && /in \d+:\d\d|BAU-SPRINT/.test(g.next || '')) || busy, 'Ziel-Leiste: ' + (g?.next ?? (busy ? busy.type + ' läuft gerade' : 'nichts')));
// Likes bringen den Gemeinschaftsbau voran
const c0 = (await (await fetch(base + '/api/state')).json()).community;
await fetch(base + '/api/sim/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, count: 200 }) });
await wait(500);
const c1 = (await (await fetch(base + '/api/state')).json()).community;
ok(c1.progress >= c0.progress, `Gemeinschaftsbau ${c0.name}: ${c0.progress} → ${c1.progress}`);
ws.close();
console.log(fails ? `${fails} Fehler` : 'Alles in Ordnung');
process.exit(fails ? 1 : 0);
