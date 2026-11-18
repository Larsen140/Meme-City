// Leben in der Stadt: fahrende Autos und laufende Bewohner.
// Autos bestehen aus mehreren "block_display"-Teilen, die alle am selben Punkt stehen
// und zusammen per Teleport (mit weicher Bewegung) bewegt werden.
import { BASE } from './city.js';

const SPEED = 6;          // Bloecke pro Sekunde
const TICK_MS = 1000;     // so oft werden die Autos bewegt
const LANE = 1;           // Abstand der Fahrspur zur Mittellinie
const COLORS = ['red', 'blue', 'yellow', 'white', 'black', 'lime', 'orange', 'light_blue', 'pink', 'purple', 'cyan', 'gray'];

// Rundkurse: Strassenringe um den Stadtplatz (halbe Seitenlaenge), Anzahl Autos je Richtung
const ROUTES = [
  { d: 30, cars: 2 },
  { d: 50, cars: 2 },
  { d: 70, cars: 3 },
  { d: 90, cars: 3 },
];

const T = (tx, ty, tz, sx, sy, sz) =>
  `transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[${tx}f,${ty}f,${tz}f],scale:[${sx}f,${sy}f,${sz}f]}`;

/** Teile eines Autos (Front zeigt Richtung +z, also Blickrichtung 0). */
function carParts(color, kind) {
  const body = `${color}_concrete`;
  const parts = [
    [body, T(-0.8, 0.3, -1.6, 1.6, 0.6, 3.2)],
    ['black_concrete', T(-0.85, 0, -1.25, 0.3, 0.5, 0.6)], ['black_concrete', T(0.55, 0, -1.25, 0.3, 0.5, 0.6)],
    ['black_concrete', T(-0.85, 0, 0.65, 0.3, 0.5, 0.6)], ['black_concrete', T(0.55, 0, 0.65, 0.3, 0.5, 0.6)],
    ['sea_lantern', T(-0.65, 0.5, 1.58, 0.35, 0.2, 0.05)], ['sea_lantern', T(0.3, 0.5, 1.58, 0.35, 0.2, 0.05)],
    ['redstone_block', T(-0.65, 0.55, -1.63, 0.3, 0.15, 0.05)], ['redstone_block', T(0.35, 0.55, -1.63, 0.3, 0.15, 0.05)],
  ];
  if (kind === 'bus') {
    parts[0] = ['yellow_concrete', T(-0.85, 0.3, -2.6, 1.7, 1.6, 5.2)];
    parts.push(['light_blue_stained_glass', T(-0.88, 1.0, -2.3, 1.76, 0.6, 4.6)]);
  } else {
    parts.push(['light_blue_stained_glass', T(-0.7, 0.9, -1.0, 1.4, 0.55, 1.7)]);
    parts.push([body, T(-0.7, 1.45, -1.0, 1.4, 0.1, 1.7)]);
  }
  return parts;
}

export class CityLife {
  constructor(mc, cfg = {}, log = console.log) {
    this.mc = mc;
    this.log = log;
    this.people = cfg.people ?? 40;
    this.cars = [];
    this.timer = null;
  }

  async start(store) {
    const mc = this.mc;
    const max = Math.max(...ROUTES.map((r) => r.d)) + 6;
    await mc.send(`forceload add ${-max} ${-max} ${max} ${max}`);
    await mc.send('kill @e[tag=mc_car]');

    // Autos verteilen
    let id = 0;
    for (const r of ROUTES) {
      for (const dir of [1, -1]) {
        const half = r.d + (dir === 1 ? -LANE : LANE); // im Uhrzeigersinn innen, sonst aussen
        const len = 8 * half;
        for (let i = 0; i < r.cars; i++) {
          const kind = id % 7 === 3 ? 'bus' : 'car';
          const car = { id: id++, half, dir, len, s: (len / r.cars) * i + (dir === -1 ? len / (2 * r.cars) : 0), kind };
          this.cars.push(car);
          const p = this.pos(car);
          const color = COLORS[car.id % COLORS.length];
          for (const [block, tr] of carParts(color, kind)) {
            await mc.send(`summon block_display ${p.x} ${BASE} ${p.z} {Tags:["mc_car","mc_car_${car.id}"],teleport_duration:${Math.round(TICK_MS / 50)},` +
              `Rotation:[${p.yaw}f,0f],block_state:"minecraft:${block}",${tr}}`);
          }
        }
      }
    }

    // Bewohner nur einmal erschaffen (sie bleiben in der Welt gespeichert)
    if (!store.data.peopleSpawned) {
      const types = ['plains', 'desert', 'jungle', 'savanna', 'snow', 'swamp', 'taiga'];
      for (let i = 0; i < this.people; i++) {
        const a = (i / this.people) * Math.PI * 2;
        const rad = 12 + (i % 3) * 5;
        const x = Math.round(Math.cos(a) * rad), z = Math.round(Math.sin(a) * rad);
        await mc.send(`summon villager ${x} ${BASE} ${z} {Tags:["mc_person"],PersistenceRequired:1b,` +
          `VillagerData:{type:"minecraft:${types[i % types.length]}",profession:"minecraft:none",level:1}}`);
      }
      for (let i = 0; i < 6; i++) await mc.send(`summon cat ${i * 3 - 8} ${BASE} -5 {PersistenceRequired:1b,Tags:["mc_pet"]}`);
      for (let i = 0; i < 4; i++) await mc.send(`summon wolf ${i * 3 - 6} ${BASE} 5 {PersistenceRequired:1b,Tags:["mc_pet"]}`);
      store.data.peopleSpawned = true;
      store.save();
    }

    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.log(`[Leben] ${this.cars.length} Autos fahren, Bewohner unterwegs`);
  }

  /** Position auf dem Rundkurs: Quadrat um (0.5, 0.5) mit halber Seitenlaenge half. */
  pos(car) {
    const h = car.half, side = 2 * h;
    let s = ((car.s % car.len) + car.len) % car.len;
    const c = 0.5;
    let x, z, yaw;
    if (car.dir === 1) { // im Uhrzeigersinn: Ost, Sued, West, Nord
      if (s < side) { x = c - h + s; z = c - h; yaw = -90; }
      else if ((s -= side) < side) { x = c + h; z = c - h + s; yaw = 0; }
      else if ((s -= side) < side) { x = c + h - s; z = c + h; yaw = 90; }
      else { s -= side; x = c - h; z = c + h - s; yaw = 180; }
    } else { // gegen den Uhrzeigersinn: Sued, Ost, Nord, West
      if (s < side) { x = c - h; z = c - h + s; yaw = 0; }
      else if ((s -= side) < side) { x = c - h + s; z = c + h; yaw = -90; }
      else if ((s -= side) < side) { x = c + h; z = c + h - s; yaw = 180; }
      else { s -= side; x = c + h - s; z = c - h; yaw = 90; }
    }
    return { x: x.toFixed(2), z: z.toFixed(2), yaw };
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const car of this.cars) {
        car.s += SPEED * (TICK_MS / 1000);
        const p = this.pos(car);
        await this.mc.send(`tp @e[tag=mc_car_${car.id}] ${p.x} ${BASE} ${p.z} ${p.yaw} 0`);
        // gleichmaessig ueber die Sekunde verteilen, damit der Kameraflug nicht ausgebremst wird
        await new Promise((r) => setTimeout(r, (TICK_MS * 0.8) / this.cars.length));
      }
    } finally {
      this.busy = false;
    }
  }

  stop() { clearInterval(this.timer); }
}
