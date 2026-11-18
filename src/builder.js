// Baut Haeuser mit Animation und steuert die Kamera.
// Alles laeuft nacheinander in einer Warteschlange, damit sich nichts ueberschneidet.
import { bigPlan, bigClearCommands } from './bigbuild.js';
import {
  BASE, HALF, plotCenter, housePlan, gardenCommands, roadCommands, scaffoldCommands,
  removeScaffoldCommands, clearPlotCommands, lampCommands, freePlotDecoration, scaffoldCleanupCommands, communityPlan, plazaCommands, COMMUNITY_CELLS, frontOf,
} from './city.js';
import { levelInfo } from './levels.js';
import { snbtString, sleep } from './minecraft.js';

/**
 * Gut lesbares Schild (Hologramm): dunkler, fast deckender Hintergrund, Schatten,
 * immer volle Helligkeit (auch im Schatten), dreht sich zur Kamera.
 */
export function signCommand(x, y, z, tags, scale, text) {
  return `summon text_display ${x} ${y} ${z} {Tags:[${tags.map((t) => '"' + t + '"').join(',')}],billboard:"center",` +
    `background:-1341124576,shadow:1b,line_width:300,brightness:{sky:15,block:15},view_range:4f,` +
    `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[${scale}f,${scale}f,${scale}f]},` +
    `text:${text}}`;
}

/** Schild "FREI" ueber einem freien Grundstueck. */
export function freeSignCommand(cx, cz, n) {
  return signCommand(cx, BASE + 4, cz, [`mc_plot_${n}`, 'mc_plot'], 3.5,
    `{text:"FREI\\n",color:"#55FF7F",bold:true,extra:[{text:"Grundstück ${n + 1}",color:"#FFFFFF",bold:true}]}`);
}

const CAM_STEP_TICKS = 1; // jeden Tick (0,05 s) ein Kameraschritt
const COLORS = [0xff4d4d, 0xffd84d, 0x4dff88, 0x4dc3ff, 0xc34dff, 0xff8a00, 0xffffff];

export class Builder {
  constructor(mc, cameraName, log = console.log) {
    this.mc = mc;
    this.cameraName = cameraName;
    this.log = log;
    this.queue = [];
    this.running = false;
    this.onEvent = () => {}; // wird von game.js gesetzt (z. B. fuers Overlay)
  }

  get busy() { return this.running || this.queue.length > 0; }

  enqueue(job) {
    // Doppelte Bau-Auftraege fuer dasselbe Grundstueck zusammenfassen
    if (job.type === 'build' && this.queue.some((j) => j.type === 'build' && j.player.id === job.player.id)) return;
    // Kamera-Wuensche nicht stapeln: pro Person nur einer, insgesamt hoechstens 6
    if (job.type === 'camera' && this.queue.some((j) => j.type === 'camera' && j.player?.id === job.player?.id)) return true;
    if (job.type === 'camera' && this.queue.filter((j) => j.type === 'camera').length >= 6) return false;
    this.queue.push(job);
    this.run();
    return true;
  }

  async run() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const job = this.queue.shift();
      // Bei langer Warteschlange schneller bauen, damit niemand ewig wartet
      this.fast = this.queue.length >= 3;
      try {
        if (job.type === 'build') await this.buildHouse(job.player, job.instant);
        else if (job.type === 'camera') await this.showHouse(job.player);
        else if (job.type === 'community') await this.buildCommunity(job.index, job.name, job.partial, job.site);
        else if (job.type === 'communityStage') await this.buildCommunityStage(job.index, job.name, job.from, job.to, job.site);
        else if (job.type === 'fn') await job.fn();
      } catch (e) {
        this.log('[Bau] Fehler: ' + e.message);
      }
    }
    this.running = false;
    this.fast = false;
    this.idleTour();
  }

  /** Drohnenflug durch die Stadt, solange nichts zu tun ist. Bricht sofort ab, wenn Arbeit kommt. */
  async idleTour() {
    if (this.touring) return;
    this.touring = true;
    const busy = () => this.running || this.queue.length > 0;
    let step = 0;
    try {
      await sleep(1500);
      while (!busy()) {
        const kind = step++ % 6;
        // Jede zweite Runde eine kleine Show in der Stadt statt nur Flug
        if ((step % 2 === 0 || this.nextShow) && this.idleShow) {
          const force = this.nextShow; this.nextShow = null;
          try { await this.idleShow(busy, force); } catch (e) { this.log('[Show] ' + e.message); }
          await this.waitIdle(1500, busy);
          continue;
        }
        if (kind === 0 || kind === 3) {
          // langsame Runde um den Stadtplatz
          const start = Math.random() * Math.PI * 2;
          for (let i = 1; i <= 4 && !busy(); i++) {
            const a = start + (i * Math.PI) / 2, r = 72;
            await this.camera(Math.cos(a) * r, BASE + 36, Math.sin(a) * r, 0, BASE + 2, 0, 6, true);
          }
        } else if (kind === 1 || kind === 4) {
          // seitlicher Schwenk ueber die Daecher (keine Hausbesuche, damit nichts wie ein wiederholter Befehl aussieht)
          const s = Math.random() < 0.5 ? 1 : -1;
          await this.camera(s * 60, BASE + 24, 30, 0, BASE + 4, -10, 6, true);
          await this.camera(-s * 60, BASE + 24, 30, 0, BASE + 4, -10, 8, true);
        } else if (false) {
          const houses = this.housesProvider?.() || [];
          if (houses.length) {
            const p = houses[Math.floor(Math.random() * houses.length)];
            const { x, z } = plotCenter(p.plot);
            this.onEvent({ type: 'tourHouse', player: p });
            await this.cameraAtPlot(x, z, Math.max((p.top ?? BASE + 10) - BASE, 10), false, 4, true);
            await this.waitIdle(5000, busy);
          }
        } else if (kind === 2) {
          // tiefer Flug ueber den Platz zum Brunnen
          await this.camera(0, BASE + 14, 48, 0, BASE + 4, 0, 5, true);
          await this.camera(0, BASE + 22, -40, 0, BASE + 2, 0, 7, true);
        } else {
          await this.camera(0, BASE + 55, 70, 0, BASE, 0, 4, true);
          await this.waitIdle(6000, busy);
        }
      }
    } finally {
      this.touring = false;
    }
  }

  async waitIdle(ms, busy) {
    const end = Date.now() + ms;
    while (Date.now() < end && !busy()) await sleep(200);
  }

  // ---------- Kamera ----------

  // Die Kamera ist eine unsichtbare Figur ("item_display"), an die der Spieler im
  // Zuschauermodus angehaengt wird. Sie wird in kleinen Schritten bewegt; Minecraft
  // gleitet weich dazwischen (teleport_duration) – so entsteht ein echter Kameraflug.

  async ensureCamera() {
    const p = this.cameraName;
    if (!this.cam) {
      this.cam = { x: 0, y: BASE + 55, z: 70, yaw: 180, pitch: 38 };
      await this.mc.send('kill @e[tag=mc_cam]');
      await this.mc.send(`summon item_display ${this.cam.x} ${this.cam.y} ${this.cam.z} {Tags:["mc_cam"],teleport_duration:${CAM_STEP_TICKS + 2},Rotation:[180f,38f]}`);
    }
    await this.mc.send(`gamemode spectator ${p}`);
    await this.mc.send(`spectate @e[tag=mc_cam,limit=1] ${p}`);
  }

  /** Fliegt die Kamera weich nach (x, y, z) mit Blick auf (lx, ly, lz). */
  async camera(x, y, z, lx, ly, lz, seconds, abortable = false, noArc = false) {
    [x, y, z, lx, ly, lz] = [x, y, z, lx, ly, lz].map(Number);
    await this.ensureCamera();
    const from = { ...this.cam };
    const dx = lx - x, dy = ly - y, dz = lz - z;
    const to = { x, y, z, yaw: (Math.atan2(-dx, dz) * 180) / Math.PI, pitch: (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI };
    let dYaw = ((to.yaw - from.yaw + 540) % 360) - 180; // kuerzester Drehweg
    const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const dur = seconds ?? Math.min(3.5, Math.max(1.2, dist / 35 + Math.abs(dYaw) / 200));
    const steps = Math.max(1, Math.round((dur * 20) / CAM_STEP_TICKS));
    const arc = noArc ? 0 : Math.min(25, dist * 0.18); // bei weiten Fluegen leicht nach oben ausholen
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    // Zeitgesteuert (nicht schrittgezaehlt): kleine Verzoegerungen beim Senden bremsen den Flug nicht aus
    const start = Date.now(), total = steps * CAM_STEP_TICKS * 50;
    for (let done = false; !done;) {
      const raw = Math.min(1, (Date.now() - start + CAM_STEP_TICKS * 50) / total);
      done = raw >= 1;
      const t = ease(raw);
      const c = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t + Math.sin(Math.PI * raw) * arc,
        z: from.z + (to.z - from.z) * t,
        yaw: from.yaw + dYaw * t,
        pitch: from.pitch + (to.pitch - from.pitch) * t,
      };
      await this.mc.send(`tp @e[tag=mc_cam,limit=1] ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.z.toFixed(2)} ${c.yaw.toFixed(1)} ${c.pitch.toFixed(1)}`);
      this.cam = { x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch };
      if (abortable && (this.running || this.queue.length)) return; // Drohnenflug weicht echter Arbeit
      if (!done) await sleep(CAM_STEP_TICKS * 50 - ((Date.now() - start) % (CAM_STEP_TICKS * 50)));
    }
    this.cam = { ...to, yaw: from.yaw + dYaw };
  }

  /** Kamera folgt einem bewegten Ziel: fn(t) mit t von 0..1 liefert {cam, look, cmds}, gleichmaessig ueber `seconds`. */
  async cameraTrack(seconds, fn) {
    await this.ensureCamera();
    const start = Date.now(), total = seconds * 1000;
    const inJob = this.running; // als Leerlauf-Show gestartet: bei neuer Arbeit Kamera sofort freigeben
    for (let done = false; !done;) {
      const t = Math.min(1, (Date.now() - start + 50) / total);
      done = t >= 1;
      const { cam, look, cmds = [] } = fn(t);
      if (!inJob && (this.running || this.queue.length)) { await this.mc.sendAll(cmds); if (done) break; await sleep(50); continue; }
      const dx = look.x - cam.x, dy = look.y - cam.y, dz = look.z - cam.z;
      const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI, pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
      await this.mc.sendAll([...cmds, `tp @e[tag=mc_cam,limit=1] ${cam.x.toFixed(2)} ${cam.y.toFixed(2)} ${cam.z.toFixed(2)} ${yaw.toFixed(1)} ${pitch.toFixed(1)}`]);
      this.cam = { ...cam, yaw, pitch };
      if (!done) await sleep(50 - ((Date.now() - start) % 50));
    }
  }

  async cameraAtPlot(cx, cz, height, inward = false, seconds, abortable = false) {
    // Kamera schaut immer von aussen (weg vom Stadtplatz) auf das Haus, etwas von oben,
    // so dass Haus und Namensschild im freien Mittelfeld des Hochformat-Streams liegen.
    // Werte an Bildschirmfotos abgestimmt: kleine Haeuser steiler von oben, Hochhaeuser flacher.
    const t = Math.max(0, Math.min(1, (height - 14) / 30));
    const lerp = (a, b) => a + (b - a) * t;
    const dist = lerp(1.5 * Math.max(height + 4, 15), height + 4);
    const targetY = BASE + height * lerp(0.25, 0.6);
    const camY = Math.max(BASE + 14, targetY + dist * lerp(0.53, 0.17));
    // Von vorne (Seite mit der Haustuer), leicht schraeg fuer einen 3D-Eindruck
    const fr = frontOf(cx, cz), k = inward ? -1 : 1;
    const side = dist * 0.35;
    const x = cx + fr.dx * dist * k + (fr.dz ? side : 0), z = cz + fr.dz * dist * k + (fr.dx ? side : 0);
    // Weiter Flug zu einem Zuschauerhaus: Wechsel wie in GTA (hoch, rueber, runter). Drohnenfluege nicht.
    const far = this.cam && Math.hypot(this.cam.x - cx, this.cam.z - cz) > 70;
    if (far && !abortable) await this.gtaSwitch(x, camY, z, cx, targetY, cz);
    else await this.camera(x, camY, z, cx, targetY, cz, seconds, abortable);
  }

  /** Kamerawechsel wie in GTA: steil in den Himmel, ueber die Stadt gleiten, auf das Ziel herabstuerzen. */
  async gtaSwitch(x, y, z, lx, ly, lz) {
    await this.ensureCamera();
    const H = BASE + 115, c = this.cam;
    const fwd = (yaw) => ({ dx: -Math.sin((yaw * Math.PI) / 180), dz: Math.cos((yaw * Math.PI) / 180) });
    const f0 = fwd(c.yaw), f1 = fwd((Math.atan2(-(lx - x), lz - z) * 180) / Math.PI);
    const whoosh = (p) => this.mc.send(`execute at @e[tag=mc_cam,limit=1] run playsound minecraft:entity.breeze.wind_burst master @a ~ ~ ~ 1.5 ${p}`);
    this.onEvent({ type: 'gta', phase: 'up' });
    await whoosh(0.7);
    // 1. senkrecht hoch, Blick nach unten
    await this.camera(c.x, H, c.z, c.x + f0.dx * 0.6, BASE, c.z + f0.dz * 0.6, 0.9, false, true);
    // 2. ueber die Stadt zum Ziel gleiten, schon in die spaetere Blickrichtung gedreht
    await this.camera(lx - f1.dx * 2, H, lz - f1.dz * 2, lx, BASE, lz, 1.3);
    this.onEvent({ type: 'gta', phase: 'down' });
    await whoosh(1.1);
    // 3. herabstuerzen in die normale Einstellung
    await this.camera(x, y, z, lx, ly, lz, 1.1, false, true);
    await this.mc.send(`execute at @e[tag=mc_cam,limit=1] run playsound minecraft:entity.generic.explode master @a ~ ~ ~ 0.25 1.6`);
  }

  async cameraOverview() {
    await this.camera(0, BASE + 55, 70, 0, BASE, 0);
  }

  /** Nahaufnahme eines Tieres im Vorgarten (x, z = Platz des Tieres, fr = Vorderseite des Grundstuecks). */
  async petCamera(x, z, fr, seconds) {
    const d = 6.5, side = 0.8;
    const camX = x + 0.5 + fr.dx * d + (fr.dz ? side : 0), camZ = z + 0.5 + fr.dz * d + (fr.dx ? side : 0);
    await this.camera(camX, BASE + 4.6, camZ, x + 0.5, BASE - 0.8, z + 0.5, seconds); // Tier etwas ueber Bildmitte, hoch genug, dass die Hecke das Tier nicht verdeckt
  }

  // ---------- Stadt-Grundlagen ----------

  async setupWorld() {
    const mc = this.mc;
    await mc.sendAll([
      'gamerule advance_time false', 'gamerule block_drops false', 'gamerule advance_weather false', 'gamerule spawn_mobs false',
      'time set noon', 'weather clear 1000000',
      `setworldspawn 0 ${BASE} 0`, 'forceload add -32 -32 31 31',
    ]);
    // alter Platz nur, solange der neue Brunnen (Meereslaterne oben) noch nicht steht
    if (!/passed/.test(await mc.send(`execute if block 0 ${BASE + 6} 0 sea_lantern`))) await mc.sendAll(plazaCommands());
    await mc.send('kill @e[tag=mc_title]');
    await mc.send(signCommand(0, BASE + 8, 0, ['mc_title'], 6, '{text:"MEME CITY",color:"#FFC93C",bold:true}'));
    await mc.send('kill @e[type=item]');
  }

  /** Entfernt Kran- und Geruestreste auf allen bebauten Grundstuecken. */
  async cleanupScaffolds(players) {
    for (const p of players) {
      if (p.plot === null) continue;
      const { x, z } = plotCenter(p.plot);
      const plan = housePlan(x, z, p.builtLevel || p.level);
      await this.mc.send(`forceload add ${x - 8} ${z - 8} ${x + 8} ${z + 8}`);
      await this.mc.sendAll(scaffoldCleanupCommands(x, z, plan));
      await this.mc.send(`forceload remove ${x - 8} ${z - 8} ${x + 8} ${z + 8}`);
    }
  }

  /** Freie Grundstuecke vorbereiten: Strassen, Rand und Schild „FREI“. */
  async prepareFreePlots(from, to) {
    const mc = this.mc;
    for (let n = from; n < to; n++) {
      if (this.isReserved?.(n)) continue; // gehoert zu einem grossen Gemeinschaftsbau
      const { x: cx, z: cz } = plotCenter(n);
      const a = cx - HALF - 5, b = cx + HALF + 5, e = cz - HALF - 5, f = cz + HALF + 5;
      await mc.send(`forceload add ${a} ${e} ${b} ${f}`);
      await mc.sendAll(roadCommands(cx, cz));
      await mc.sendAll(clearPlotCommands(cx, cz));
      await mc.sendAll(lampCommands(cx, cz));
      await mc.sendAll(freePlotDecoration(cx, cz, n));
      await mc.sendAll([
        `kill @e[tag=mc_plot_${n}]`,
        freeSignCommand(cx, cz, n),
      ]);
      await mc.send('kill @e[type=item]');
      await mc.send(`forceload remove ${a} ${e} ${b} ${f}`);
    }
  }

  // ---------- Namensschild ----------

  async nameTag(player, top) {
    const { x, z } = plotCenter(player.plot);
    const info = levelInfo(player.level);
    const tag = `mc_plot_${player.plot}`;
    await this.mc.send(`kill @e[tag=${tag}]`);
    const name = snbtString(`@${player.name}\n`);
    const line = snbtString(`Stufe ${player.level} · ${info.name}`);
    await this.mc.send(signCommand(x, top + 4, z, [tag, 'mc_plot'], 3.5,
      `{text:${name},color:"#FFD84D",bold:true,extra:[{text:${line},color:"#FFFFFF",bold:true}]}`));
  }

  // ---------- Effekte ----------

  async firework(x, y, z, big = false) {
    const colors = [COLORS[Math.floor(Math.random() * COLORS.length)], COLORS[Math.floor(Math.random() * COLORS.length)]];
    const shape = big ? 'large_ball' : ['small_ball', 'star', 'burst'][Math.floor(Math.random() * 3)];
    await this.mc.send(`summon firework_rocket ${x} ${y} ${z} {LifeTime:${big ? 30 : 20},FireworksItem:{id:"firework_rocket",count:1,` +
      `components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"${shape}",colors:[I;${colors.join(',')}],has_twinkle:true,has_trail:true}]}}}}`);
  }

  async fireworkShow(x, z, count = 8, spread = 8) {
    for (let i = 0; i < count; i++) {
      await this.firework(x + Math.round((Math.random() - 0.5) * spread * 2), BASE + 2, z + Math.round((Math.random() - 0.5) * spread * 2), i % 3 === 0);
      await sleep(250);
    }
  }

  // ---------- Haus bauen ----------

  async buildHouse(player, instant = false) {
    const mc = this.mc;
    const { x: cx, z: cz } = plotCenter(player.plot);
    const level = player.level;
    // eigene Dachfarbe (Chat-Befehl "farbe")
    const plan = housePlan(cx, cz, player.color ? { ...levelInfo(level), roof: `${player.color}_concrete` } : level);
    const height = plan.top - BASE;
    const a = cx - HALF - 5, b = cx + HALF + 5, e = cz - HALF - 5, f = cz + HALF + 5;

    await mc.send(`forceload add ${a} ${e} ${b} ${f}`);
    await mc.sendAll(roadCommands(cx, cz));

    if (instant) {
      await mc.sendAll(clearPlotCommands(cx, cz)); await mc.send('kill @e[type=item]');
      for (const l of plan.layers) await mc.sendAll(l.cmds);
      await mc.sendAll(gardenCommands(cx, cz, plan));
      await this.nameTag(player, plan.top);
      await mc.send(`forceload remove ${a} ${e} ${b} ${f}`);
      player.builtLevel = level;
      player.top = plan.top;
      this.onEvent({ type: 'buildDone', player, level, instant: true }); // speichert den Stand
      return;
    }

    this.onEvent({ type: 'buildStart', player, level });
    // 1. Kamera hin
    await this.cameraAtPlot(cx, cz, Math.max(height, 10));
    await sleep(1200);
    // 2. Rauchwolke, altes Haus weg
    await mc.send(`particle minecraft:campfire_cosy_smoke ${cx} ${BASE + 3} ${cz} 4 4 4 0.02 300 force`);
    await mc.send(`particle minecraft:cloud ${cx} ${BASE + 2} ${cz} 4 3 4 0.08 400 force`);
    await mc.send(`playsound minecraft:entity.generic.explode master @a ${cx} ${BASE + 3} ${cz} 2 0.8`);
    await sleep(400);
    await mc.sendAll(clearPlotCommands(cx, cz)); await mc.send('kill @e[type=item]');
    await sleep(900);
    // 3. Geruest und Kran
    await mc.sendAll(scaffoldCommands(cx, cz, plan, plan.top));
    await mc.send(`playsound minecraft:block.anvil.place master @a ${cx} ${BASE + 3} ${cz} 1 1.2`);
    await this.spawnWorkers(plan, cx, cz);
    await sleep(700);
    // 4. Schicht fuer Schicht – die Bauarbeiter klettern mit nach oben
    const delay = this.fast ? 60 : Math.max(120, Math.min(450, 5000 / plan.layers.length));
    player.top = plan.top;
    for (const l of plan.layers) {
      await mc.sendAll(l.cmds);
      await this.moveWorkers(plan, l.y, cx, cz);
      await mc.send(`particle minecraft:happy_villager ${cx} ${l.y + 0.5} ${cz} ${plan.x2 - cx} 0.3 ${plan.z2 - cz} 0 25 force`);
      await mc.send(`playsound minecraft:block.stone.place master @a ${cx} ${l.y} ${cz} 1 ${0.8 + Math.random() * 0.6}`);
      await sleep(delay);
    }
    await mc.send(`particle minecraft:end_rod ${cx} ${plan.top} ${cz} 3 2 3 0.05 60 force`);
    // 5. Geruest weg, Garten
    await sleep(500);
    await mc.sendAll(removeScaffoldCommands(cx, cz, plan.top));
    await mc.sendAll(gardenCommands(cx, cz, plan));
    await this.workersDone(plan, cx, cz);
    await mc.send(`playsound minecraft:block.grass.place master @a ${cx} ${BASE} ${cz} 1 1`);
    // 6. Schild + Feuerwerk
    await this.nameTag(player, plan.top);
    await mc.send(`playsound minecraft:entity.player.levelup master @a ${cx} ${BASE + 3} ${cz} 2 1`);
    this.onEvent({ type: 'buildDone', player, level });
    await this.fireworkShow(cx, cz, this.fast ? 3 : level >= 10 ? 10 : 5, 6);
    await sleep(this.fast ? 800 : 2500);
    await mc.send(`forceload remove ${a} ${e} ${b} ${f}`);
    player.builtLevel = level;
  }

  // ---------- Bauarbeiter ----------
  // Vier Figuren (Mannequins) mit gelbem Helm stehen auf den Ecken der gerade gebauten Schicht
  // und schlagen mit ihrem Werkzeug. Getaggt mit mc_gift_tmp, damit Neustarts sie aufraeumen.

  async spawnWorkers(plan, cx, cz) {
    const tools = ['iron_pickaxe', 'iron_shovel', 'bricks', 'iron_axe'];
    const shirts = [16744448, 16744448, 3949738, 16744448]; // orange Westen, einer in Blau
    this.workerGen = (this.workerGen || 0) + 1; // alter Aufraeum-Timer greift nicht mehr
    await this.mc.send('kill @e[tag=mc_worker]');
    for (let k = 0; k < 4; k++) {
      const [x, z] = this.workerCorner(plan, k, 2);
      await this.mc.send(`summon mannequin ${x} ${BASE} ${z} {Tags:["mc_worker","mc_worker${k}","mc_gift_tmp"],hide_description:1b,immovable:1b,NoGravity:1b,Invulnerable:1b,` +
        `equipment:{head:{id:"minecraft:leather_helmet",components:{"minecraft:dyed_color":16766720}},chest:{id:"minecraft:leather_chestplate",components:{"minecraft:dyed_color":${shirts[k]}}},` +
        `legs:{id:"minecraft:leather_leggings",components:{"minecraft:dyed_color":3355443}},feet:{id:"minecraft:leather_boots",components:{"minecraft:dyed_color":6704179}},mainhand:{id:"minecraft:${tools[k]}"}}}`);
    }
    await this.mc.send(`execute as @e[tag=mc_worker] at @s run tp @s ~ ~ ~ facing ${cx} ${BASE} ${cz}`);
  }

  /** Ecke k des Hauses (0..3), um `out` Bloecke nach aussen versetzt. */
  workerCorner(plan, k, out = 0) {
    const x = k & 1 ? plan.x2 + out : plan.x1 - out, z = k & 2 ? plan.z2 + out : plan.z1 - out;
    return [x + 0.5, z + 0.5];
  }

  async moveWorkers(plan, y, cx, cz) {
    this.workerStep = (this.workerStep || 0) + 1;
    const cmds = [];
    for (let k = 0; k < 4; k++) {
      const [x, z] = this.workerCorner(plan, k);
      cmds.push(`tp @e[tag=mc_worker${k},limit=1] ${x} ${y + 1} ${z} facing ${cx} ${y + 0.5} ${cz}`);
    }
    // abwechselnd zwei Arbeiter schlagen zu
    cmds.push(`swing @e[tag=mc_worker${this.workerStep % 2}] mainhand`, `swing @e[tag=mc_worker${2 + (this.workerStep % 2)}] mainhand`);
    await this.mc.sendAll(cmds);
  }

  async workersDone(plan, cx, cz) {
    const fr = plan.front || frontOf(cx, cz);
    const cmds = [];
    for (let k = 0; k < 4; k++) {
      // in einer Reihe vor dem Haus aufstellen, Blick zur Kamera (nach vorne)
      const off = (k - 1.5) * 1.6, d = (fr.dx ? plan.x2 - plan.x1 : plan.z2 - plan.z1) / 2 + 3;
      const x = cx + fr.dx * d + (fr.dz ? off : 0) + 0.5, z = cz + fr.dz * d + (fr.dx ? off : 0) + 0.5;
      cmds.push(`tp @e[tag=mc_worker${k},limit=1] ${x} ${BASE} ${z} facing ${x + fr.dx * 5} ${BASE + 1} ${z + fr.dz * 5}`);
    }
    cmds.push('swing @e[tag=mc_worker] mainhand', `particle minecraft:happy_villager ${cx} ${BASE + 1} ${cz} 4 1 4 0 30 force`);
    await this.mc.sendAll(cmds);
    const gen = (this.workerGen = (this.workerGen || 0) + 1);
    setTimeout(() => { if (this.workerGen === gen) this.mc.send('kill @e[tag=mc_worker]'); }, 6000);
  }

  async showHouse(player) {
    const { x, z } = plotCenter(player.plot);
    const plan = housePlan(x, z, player.builtLevel || player.level);
    this.onEvent({ type: 'showHouse', player });
    await this.cameraAtPlot(x, z, Math.max(plan.top - BASE, 10));
    await this.mc.send(`particle minecraft:totem_of_undying ${x} ${plan.top + 2} ${z} 1 1 1 0.3 80 force`);
    await sleep(6000);
  }

  /** Baustelle: Teil eines Gemeinschaftsbaus setzen (from/to = Anteil 0..1). */
  /** Ort, Bauplan und Aufraeum-Befehle eines Gemeinschaftsbaus (klein am Stadtplatz oder gross am Stadtrand). */
  communitySite(index, name, site) {
    const cell = site || COMMUNITY_CELLS[index % COMMUNITY_CELLS.length];
    const plan = cell.big ? bigPlan(name, cell.x, cell.z) : communityPlan(name, cell.x, cell.z);
    const clear = cell.big ? bigClearCommands(cell) : clearPlotCommands(cell.x, cell.z).map((c) => c.replace('grass_block', 'smooth_stone'));
    return { cell, plan, clear, height: Math.max(plan.top - BASE, cell.big ? 24 : 12) };
  }

  /** Bauplatz fuer einen grossen Gemeinschaftsbau markieren (FREI-Schilder weg, Bauplatz-Schild hin). */
  async markBigSite(index, name, site) {
    await this.mc.sendAll(site.plots.map((n) => `kill @e[tag=mc_plot_${n}]`));
    await this.mc.send(`kill @e[tag=mc_comm_${index}]`);
    await this.mc.send(signCommand(site.x, BASE + 6, site.z, [`mc_comm_${index}`], 4, `{text:"BAUPLATZ\\n",color:"#FFC93C",bold:true,extra:[{text:${snbtString(name)},color:"#FFFFFF",bold:true}]}`));
  }

  async buildCommunityStage(index, name, from, to, site) {
    const { cell, plan, clear, height } = this.communitySite(index, name, site);
    const n = plan.layers.length, a = Math.floor(from * n), b = Math.max(a + 1, Math.floor(to * n));
    await this.cameraAtPlot(cell.x, cell.z, height, true);
    await sleep(600);
    if (from <= 0) await this.mc.sendAll(clear);
    for (const l of plan.layers.slice(a, b)) {
      await this.mc.sendAll(l.cmds);
      await this.mc.send(`particle minecraft:happy_villager ${cell.x} ${l.y + 0.5} ${cell.z} 5 0.3 5 0 25 force`);
      await sleep(250);
    }
    await this.mc.send(`playsound minecraft:block.anvil.use master @a ${cell.x} ${BASE + 3} ${cell.z} 1.5 1.2`);
    await sleep(2500);
  }

  async buildCommunity(index, name, partial = false, site) {
    const { cell, plan, clear, height } = this.communitySite(index, name, site);
    await this.cameraAtPlot(cell.x, cell.z, height, true);
    await sleep(800);
    if (!partial) await this.mc.sendAll(clear);
    for (const l of plan.layers) {
      await this.mc.sendAll(l.cmds);
      await this.mc.send(`particle minecraft:happy_villager ${cell.x} ${l.y + 0.5} ${cell.z} 5 0.3 5 0 25 force`);
      await sleep(200);
    }
    await this.mc.send(`kill @e[tag=mc_comm_${index}]`);
    await this.mc.send(signCommand(cell.x, plan.top + 4, cell.z, [`mc_comm_${index}`], 4, `{text:${snbtString(name)},color:"#5CE1FF",bold:true}`));
    await this.fireworkShow(cell.x, cell.z, 12, 7);
    await sleep(3000);
  }
}
