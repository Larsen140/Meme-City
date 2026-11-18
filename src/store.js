// Speicherstand: alle Zuschauer, Haeuser und Gemeinschaftsbauten in data/save.json.
import fs from 'fs';
import path from 'path';

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { players: {}, nextPlot: 0, community: { index: 0, progress: 0 }, totals: { coins: 0, likes: 0 } };
    if (fs.existsSync(file)) {
      try { Object.assign(this.data, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { console.log('[Speicher] Datei kaputt, starte leer:', e.message); }
    }
    this.timer = null;
  }

  get players() { return this.data.players; }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 1000);
  }

  saveNow() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
}
