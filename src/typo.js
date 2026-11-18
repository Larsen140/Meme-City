// Tippfehler-Hilfe: erkennt falsch geschriebene Chat-Befehle ("hause", "frabe rto", "haustier pingiun").

/** Abstand zweier Woerter (Einfuegen, Loeschen, Ersetzen, zwei Buchstaben vertauscht). */
export function dist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const norm = (s) => s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

/** Bestes Wort aus keys, das fast gleich geschrieben ist (kurze Woerter: 1 Fehler, lange: 2). */
export function closest(word, keys) {
  const w = norm(word);
  if (w.length < 3) return null;
  let best = null, bd = 99;
  for (const k of keys) {
    const kk = norm(k);
    const max = kk.length >= 7 ? 2 : 1;
    const dd = dist(w, kk);
    if (dd <= max && dd < bd) { bd = dd; best = k; }
  }
  return best;
}

// Echte Woerter, die einem Befehl nur aehnlich sehen – die nie "korrigieren"
const REAL = new Set(['aus', 'raus', 'maus', 'laus', 'hans', 'haut', 'hase', 'hat', 'has', 'hau', 'hallo', 'zeit', 'zeige', 'zeigt', 'mord', 'norm', 'farm', 'part', 'paris', 'patty', 'harte', 'hart', 'heute', 'hause',
  'farben', 'garbe', 'narbe', 'party', 'haus', 'zeig', 'nord', 'farbe', 'haustier', 'sorry', 'haha', 'hahah', 'zeug', 'lord', 'word', 'wort', 'teig', 'nerd', 'bord', 'fabel']);
const CMDS = ['haus', 'haustier', 'farbe', 'party', 'zeig', 'nord'];

/**
 * Prueft eine kurze Chat-Nachricht auf einen vertippten Befehl.
 * Gibt { fixed, from, to } zurueck (fixed = korrigierte Nachricht) oder null.
 */
export function fixCommand(text) {
  const words = text.toLowerCase().replace(/[^a-zäöüß ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 4) return null;
  const w = words[0];
  if (REAL.has(w)) {
    // "hause" ist meist "Haus" (zuhause wuerde man nicht allein schreiben)
    if (w === 'hause' && words.length === 1) return { fixed: 'haus', from: w, to: 'haus' };
    return null;
  }
  const to = closest(w, CMDS);
  if (!to) return null;
  return { fixed: [to, ...words.slice(1)].join(' '), from: w, to };
}
