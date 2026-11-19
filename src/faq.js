// Wissen des Buergermeisters: beantwortet Fragen aus dem Chat zur Stadt und zu den Funktionen.
// Antworten sind kurz (werden vorgelesen) und – wo moeglich – persoenlich.
// WICHTIG: Keine Aufforderung zu Geschenken (TikTok-Richtlinie).
import { MAX_LEVEL, levelInfo } from './levels.js';
import { art } from './city.js';

const fmt = (n) => Math.round(n).toLocaleString('de-DE');

/** Ist die Nachricht eine Frage? */
export function isQuestion(t) {
  return /\?/.test(t)
    || /^(wie|was|wo|wann|warum|wieso|weshalb|welche[rsnm]?|wer|wem|wen|kann|kannst|darf|gibt es|gibts|habe ich|hab ich|bin ich|ist das|muss|soll|how|what|where|why)\b/.test(t)
    || /\b(erklär|erklaer|hilfe|help)\b/.test(t);
}

/**
 * Sucht eine passende Antwort. game = Game-Objekt (fuer Zahlen und die Spieler-Karte), p = Fragesteller.
 * Gibt einen Satz zurueck oder null.
 */
export function answer(game, p, t, name) {
  const s = game.state();
  const c = game.card(p);
  const has = p.plot !== null;
  const lpp = game.likesPerPoint;
  const rules = [
    // ---- persoenlich ----
    [/(welche|meine|was für eine|was fuer eine).*(stufe|level)|stufe.*(hab|bin) ich|(hab|bin) ich.*stufe|wie (weit|groß|gross) ist mein/, () => has
      ? (c.nextLevel
        ? `${name}, du hast Stufe ${c.level}, ein ${c.levelName}. ${c.likesNeeded > 0 ? `Noch ${fmt(c.likesNeeded)} Likes bis zum ${c.nextName}!` : `Gleich kommt der ${c.nextName}!`}`
        : `${name}, du hast schon die höchste Stufe: ${c.levelName}! Respekt!`)
      : `${name}, du hast noch kein Haus. Schreib einfach Haus in den Chat!`],
    [/(welcher|mein) platz|platz.*(bin|hab) ich|(bin|hab) ich.*platz|mein rang/, () => has
      ? `${name}, du bist auf Platz ${c.rank} von ${fmt(s.houses)} Häusern.`
      : `${name}, ohne Haus noch kein Platz. Schreib Haus!`],
    [/wo (ist|steht|wohne)|mein haus (sehen|zeigen|finden)|wie (seh|find|komm).*haus/, () => has
      ? `${name}, schreib zeig mein Haus, dann fliege ich mit der Kamera hin!`
      : `${name}, du hast noch kein Haus. Schreib Haus, dann baue ich dir eins!`],
    // ---- Befehle ----
    [/farbe|dach|anmal|streich/, () => `Schreib zum Beispiel farbe rot, farbe blau oder farbe lila. Dann streiche ich dein Dach neu!`],
    [/haustier|tier|hund|katze|pinguin|pet/, () => `Schreib haustier und ein Tier, zum Beispiel haustier katze, hund, pinguin, löwe, drache oder faultier. Das Tier zieht in deinen Vorgarten!`],
    [/party|feier/, () => `Schreib party, dann gibt es Feuerwerk bei deinem Haus!`],
    [/nord|süd|sued|team|duell|kampf/, () => `Alle paar Minuten kämpfen Nord gegen Süd. Schreib nord oder süd und like für dein Team. Die Gewinner bekommen Bonuspunkte!`],
    [/abstimm|wählen|waehlen|voting|verlosung|was passiert (als nächstes|gleich)/, () => `Alle paar Minuten stimmt ihr ab, was passiert. Schreib dann eins, zwei oder drei. Jede Stimme gibt auch einen Punkt fürs Haus!`],
    [/befehl|was kann (man|ich)|was (geht|gibt es)|commands?/, () => `Du kannst schreiben: Haus, zeig mein Haus, farbe rot, haustier pinguin, flagge deutschland, party, nord oder süd. Probier's aus!`],
    // ---- Haus bekommen und aufsteigen ----
    [/(wie|wo).*(bekomm|krieg|kriege|hol|mach).*(\bhaus\b|grundstück|grundstueck)|haus (bekommen|kriegen|haben)|mitmachen|mitspielen|wie spielt man|wie geht (das|es)|wie funktioniert/, () =>
      `Ganz einfach: Schreib Haus in den Chat, dann bekommst du ein eigenes Grundstück. Mit Likes wird dein Haus Stufe für Stufe größer!`],
    [/(wie|was).*(aufsteig|steig|größer|groesser|upgrade|ausbau|level ?up|wachs|stufe (hoch|steigen))|wie viele likes|wieviel likes|likes (brauch|für|fuer)/, () => has && c.nextLevel
      ? `${name}, ${lpp} Likes sind ein Upgrade-Punkt. Dir fehlen noch ${fmt(c.likesNeeded)} Likes bis zum ${c.nextName}.`
      : `${lpp} Likes sind ein Upgrade-Punkt. Mit genug Punkten steigt dein Haus eine Stufe auf, bis hoch zum Königspalast!`],
    [/wie viele stufen|höchste stufe|hoechste stufe|letzte stufe|max(imal)?.*stufe|königspalast|koenigspalast/, () =>
      `Es gibt ${MAX_LEVEL} Stufen: von der ${levelInfo(1).name} über Villa und Hochhaus bis zum ${levelInfo(MAX_LEVEL).name}.`],
    [/geschenk|coins?|rose|gift/, () =>
      `${name}, alles was du im LIVE machst, zählt für dein Haus.`],
    // ---- Stadt ----
    [/gemeinschaftsbau|rathaus|fußballplatz|fussballplatz|freibad|was wird gebaut|nächste gebäude|naechste gebaeude/, () => s.community
      ? `Gerade bauen wir zusammen an ${art(s.community.name, 'dat')}: ${fmt(s.community.progress)} von ${fmt(s.community.goal)} Punkten. Jeder Punkt für dein Haus zählt auch dafür!`
      : `Alle Gemeinschaftsbauten sind fertig. Danke an alle!`],
    [/ehrenbürgermeister|ehrenbuergermeister|krone/, () => s.honorary
      ? `Ehrenbürgermeister ist, wer auf Platz eins steht. Gerade ist das ${s.honorary.nick || s.honorary.name} und trägt die goldene Krone!`
      : `Ehrenbürgermeister wird, wer auf Platz eins steht. Der Platz ist noch frei!`],
    [/wer ist (erster|erste|platz (1|eins))|bestenliste|top ?5|wer führt|wer fuehrt/, () => s.top[0]
      ? `Platz eins ist ${s.top[0].nick || s.top[0].name} mit Stufe ${s.top[0].level}!`
      : `Noch steht niemand auf Platz eins. Das kannst du sein!`],
    [/wie viele (häuser|haeuser|leute|bürger|buerger|einwohner|haustiere|tiere)/, () =>
      `Meme City hat ${fmt(s.houses)} Häuser, ${fmt(s.citizens)} Bürger und ${fmt(s.pets || 0)} Haustiere!`],
    [/like.?ziel|tornado|meteor|event|regenbogen|schneesturm/, () =>
      `Oben siehst du das Like-Ziel. Wenn wir es zusammen schaffen, passiert ein großes Event, zum Beispiel ein Tornado oder ein Meteorregen!`],
    [/treue|bonus|dabeibleiben/, () => `Schreib einfach Befehle wie Haus, haustier katze oder flagge deutschland. Viel Spaß in Meme City!`],
    [/denkmal|statue/, () => `Auf dem Stadtplatz stehen Denkmäler für die größten Fans der Stadt.`],
    [/wer bist du|bist du (ein )?(bot|ki|echt|mensch)|bürgermeister|buergermeister/, () =>
      `Ich bin Bürgermeister Memo, ich kümmere mich um Meme City. Gebaut wird hier alles von euch über den Chat!`],
    [/was ist (das|meme city|hier)|worum geht|was macht ihr|was passiert hier/, () =>
      `Meme City ist eine Minecraft-Stadt, die ihr im LIVE baut. Schreib Haus und du bekommst dein eigenes Haus!`],
    [/minecraft|server|version|join|beitreten|ip/, () =>
      `Mitgebaut wird nur über den Chat, auf den Server selbst kann man nicht. Schreib einfach Haus!`],
  ];
  for (const [re, fn] of rules) if (re.test(t)) return fn();
  return null;
}
