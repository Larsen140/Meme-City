// Verbindung zum Minecraft-Server per RCON (mit automatischem Neuverbinden).
import { Rcon } from 'rcon-client';

export class Minecraft {
  constructor(cfg, log = console.log) {
    this.cfg = cfg;
    this.log = log;
    this.rcon = null;
    this.connecting = null;
    this.connected = false;
  }

  async connect() {
    if (this.rcon) return this.rcon;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      try {
        const r = await Rcon.connect({ host: this.cfg.host, port: this.cfg.port, password: this.cfg.password });
        r.on('end', () => { this.rcon = null; this.connected = false; this.log('[MC] Verbindung getrennt'); });
        r.on('error', () => {});
        this.rcon = r;
        this.connected = true;
        this.log('[MC] Mit Minecraft verbunden');
        return r;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  /** Einen Befehl schicken. Gibt die Antwort zurueck oder '' bei Fehler. */
  async send(cmd) {
    try {
      const r = await this.connect();
      const res = await r.send(cmd);
      if (/Unknown|Incorrect|Expected|Invalid|error/i.test(res)) this.log(`[MC] Problem: ${cmd}\n     -> ${res}`);
      return res;
    } catch (e) {
      this.rcon = null;
      this.connected = false;
      return '';
    }
  }

  async sendAll(cmds) {
    for (const c of cmds) await this.send(c);
  }
}

/** Text fuer SNBT (in doppelten Anfuehrungszeichen) sicher machen. */
export function snbtString(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
