// Baut Haeuser mit Animation und steuert die Kamera.
// Alles laeuft nacheinander in einer Warteschlange, damit sich nichts ueberschneidet.
import {
  BASE, HALF, plotCenter, housePlan, gardenCommands, roadCommands, scaffoldCommands,
  removeScaffoldCommands, clearPlotCommands, lampCommands, freePlotDecoration, communityPlan, plazaCommands, COMMUNITY_CELLS,
} from './city.js';
import { levelInfo } from './levels.js';
import { snbtString, sleep } from './minecraft.js';

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
    await this.cameraOverview();
  }

  // ---------- Kamera ----------

  async camera(x, y, z, lx, ly, lz) {
    const p = this.cameraName;
    await this.mc.send(`gamemode spectator ${p}`);
    await this.mc.send(`tp ${p} ${x} ${y} ${z} facing ${lx} ${ly} ${lz}`);
  }

  async cameraAtPlot(cx, cz, height) {
    const dist = 16 + Math.round(height * 0.5);
    await this.camera(cx + 6, BASE + Math.round(height * 0.6) + 6, cz + dist, cx, BASE + Math.round(height * 0.45), cz);
  }

  async cameraOverview() {
    await this.camera(0, BASE + 55, 70, 0, BASE, 0);
  }

  // ---------- Stadt-Grundlagen ----------

  async setupWorld() {
    const mc = this.mc;
    await mc.sendAll([
      'gamerule advance_time false', 'gamerule block_drops false', 'gamerule advance_weather false', 'gamerule spawn_mobs false',
      'time set noon', 'weather clear',
      `setworldspawn 0 ${BASE} 0`, 'forceload add -32 -32 31 31',
    ]);
    await mc.sendAll(plazaCommands());
    await mc.send('kill @e[tag=mc_title]');
    await mc.send(`summon text_display 0 ${BASE + 7} 0 {Tags:["mc_title"],billboard:"center",background:0,shadow:1b,` +
      `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[5f,5f,5f]},` +
      `text:{text:"MEME CITY",color:"gold",bold:true}}`);
    await mc.send('kill @e[type=item]');
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
        `summon text_display ${cx} ${BASE + 3} ${cz} {Tags:["mc_plot_${n}","mc_plot"],billboard:"center",background:1426063360,` +
          `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[2.5f,2.5f,2.5f]},` +
          `text:{text:"FREI\\n",color:"green",bold:true,extra:[{text:"Grundstück ${n + 1}",color:"white",bold:false}]}}`,
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
    await this.mc.send(`summon text_display ${x} ${top + 3} ${z} {Tags:["${tag}","mc_plot"],billboard:"center",background:1426063360,` +
      `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[2.5f,2.5f,2.5f]},` +
      `text:{text:${name},color:"gold",bold:true,extra:[{text:${line},color:"white",bold:false}]}}`);
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
    const plan = housePlan(cx, cz, level);
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
    const delay = Math.max(120, Math.min(450, 5000 / plan.layers.length));
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
    await this.fireworkShow(cx, cz, level >= 10 ? 10 : 5, 6);
    await sleep(2500);
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
    await this.cameraAtPlot(cell.x, cell.z, Math.max(plan.top - BASE, 12));
    await sleep(800);
    await this.mc.sendAll(clearPlotCommands(cell.x, cell.z).map((c) => c.replace('grass_block', 'smooth_stone')));
    for (const l of plan.layers) {
      await this.mc.sendAll(l.cmds);
      await this.mc.send(`particle minecraft:happy_villager ${cell.x} ${l.y + 0.5} ${cell.z} 5 0.3 5 0 25 force`);
      await sleep(200);
    }
    await this.mc.send(`kill @e[tag=mc_comm_${index}]`);
    await this.mc.send(`summon text_display ${cell.x} ${plan.top + 3} ${cell.z} {Tags:["mc_comm_${index}"],billboard:"center",` +
      `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[3f,3f,3f]},` +
      `text:{text:${snbtString(name)},color:"aqua",bold:true}}`);
    await this.fireworkShow(cell.x, cell.z, 12, 7);
    await sleep(3000);
  }
}
