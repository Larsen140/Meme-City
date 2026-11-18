// Testlauf: spielt typische Zuschauer-Aktionen nacheinander ab.
const steps = [
  ['chat', { user: 'timo', text: 'Haus' }, 12],
  ['follow', { user: 'nastjaxd' }, 12],
  ['like', { user: 'timo', count: 600 }, 14],
  ['gift', { user: 'nastjaxd', gift: 'herz' }, 18],
  ['chat', { user: 'timo', text: 'Zeig mal mein Haus' }, 10],
  ['gift', { user: 'ben.builder', gift: 'universe' }, 30],
];
for (const [kind, body, wait] of steps) {
  await fetch('http://localhost:3000/api/sim/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  console.log(new Date().toLocaleTimeString('de-DE'), kind, JSON.stringify(body));
  await new Promise((r) => setTimeout(r, wait * 1000));
}
