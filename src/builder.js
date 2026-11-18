// Baut Haeuser mit Animation und steuert die Kamera.
// Alles laeuft nacheinander in einer Warteschlange, damit sich nichts ueberschneidet.
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
    // Kamera-Wuensche nicht stapeln
    if (job.type === 'camera' && this.queue.filter((j) => j.type === 'camera').length >= 3) return;
    this.queue.push(job);
    this.run();
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
        else if (job.type === 'community') await this.buildCommunity(job.index, job.name);
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
  async camera(x, y, z, lx, ly, lz, seconds, abortable = false) {
    [x, y, z, lx, ly, lz] = [x, y, z, lx, ly, lz].map(Number);
    await this.ensureCamera();
    const from = { ...this.cam };
    const dx = lx - x, dy = ly - y, dz = lz - z;
    const to = { x, y, z, yaw: (Math.atan2(-dx, dz) * 180) / Math.PI, pitch: (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI };
    let dYaw = ((to.yaw - from.yaw + 540) % 360) - 180; // kuerzester Drehweg
    const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const dur = seconds ?? Math.min(3.5, Math.max(1.2, dist / 35 + Math.abs(dYaw) / 200));
    const steps = Math.max(1, Math.round((dur * 20) / CAM_STEP_TICKS));
    const arc = Math.min(25, dist * 0.18); // bei weiten Fluegen leicht nach oben ausholen
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
    await this.camera(x, camY, z, cx, targetY, cz, seconds, abortable);
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
    await mc.sendAll(plazaCommands());
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
    const shape = big ? 'large_ball' : ['ball', 'star', 'burst'][Math.floor(Math.random() * 3)];
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
    await sleep(700);
    // 4. Schicht fuer Schicht
    const delay = this.fast ? 60 : Math.max(120, Math.min(450, 5000 / plan.layers.length));
    player.top = plan.top;
    for (const l of plan.layers) {
      await mc.sendAll(l.cmds);
      await mc.send(`particle minecraft:happy_villager ${cx} ${l.y + 0.5} ${cz} ${plan.x2 - cx} 0.3 ${plan.z2 - cz} 0 25 force`);
      await mc.send(`playsound minecraft:block.stone.place master @a ${cx} ${l.y} ${cz} 1 ${0.8 + Math.random() * 0.6}`);
      await sleep(delay);
    }
    await mc.send(`particle minecraft:end_rod ${cx} ${plan.top} ${cz} 3 2 3 0.05 60 force`);
    // 5. Geruest weg, Garten
    await sleep(500);
    await mc.sendAll(removeScaffoldCommands(cx, cz, plan.top));
    await mc.sendAll(gardenCommands(cx, cz, plan));
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

  async showHouse(player) {
    const { x, z } = plotCenter(player.plot);
    const plan = housePlan(x, z, player.builtLevel || player.level);
    this.onEvent({ type: 'showHouse', player });
    await this.cameraAtPlot(x, z, Math.max(plan.top - BASE, 10));
    await this.mc.send(`particle minecraft:totem_of_undying ${x} ${plan.top + 2} ${z} 1 1 1 0.3 80 force`);
    await sleep(6000);
  }

  async buildCommunity(index, name) {
    const cell = COMMUNITY_CELLS[index % COMMUNITY_CELLS.length];
    const plan = communityPlan(name, cell.x, cell.z);
    await this.cameraAtPlot(cell.x, cell.z, Math.max(plan.top - BASE, 12), true);
    await sleep(800);
    await this.mc.sendAll(clearPlotCommands(cell.x, cell.z).map((c) => c.replace('grass_block', 'smooth_stone')));
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
