// Drehendes Riesenrad: Gestell aus Bloecken, Rad und Gondeln aus block_display-Teilen,
// die jede Sekunde ein Stueck weitergedreht werden (Minecraft interpoliert weich dazwischen).
import { frontOf, BASE, GROUND } from './city.js';

export const WHEEL_R = 13;          // Radius
const HUB_T = 17.5;                 // Nabe ueber BASE
const STEP_DEG = 5, TICK_MS = 1000; // 5 Grad pro Sekunde = eine Runde in 72 s
const RIM = 24, SPOKES = 8, GONDOLAS = 8;
const COLORS = ['red', 'yellow', 'lime', 'light_blue', 'orange', 'pink', 'purple', 'cyan'];

// ---------- kleine Quaternion-Hilfen ([x, y, z, w] wie in Minecraft) ----------
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qrot = (q, v) => {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [p[0], p[1], p[2]];
};
const qz = (deg) => { const h = (deg * Math.PI) / 360; return [0, 0, Math.sin(h), Math.cos(h)]; };
const f3 = (v) => v.map((n) => `${n.toFixed(3)}f`).join(',');

/** Lage des Rads: Achse zeigt vom Stadtplatz weg, damit die Kamera von vorne auf das Rad schaut. */
export function wheelFrame(x, z) {
  const f = frontOf(x, z);
  const alongX = f.dx !== 0;
  return {
    Q0: alongX ? [0, Math.SQRT1_2, 0, Math.SQRT1_2] : [0, 0, 0, 1], // lokale Z-Achse -> Weltachse
    u: alongX ? { x: 0, z: -1 } : { x: 1, z: 0 },                // Richtung in der Radebene
    a: alongX ? { x: 1, z: 0 } : { x: 0, z: 1 },                 // Drehachse
    f,
  };
}

/** Gestell (echte Bloecke): Bodenplatte, zwei A-Boecke, Achse, Kassenhaeuschen und Absperrung. */
export function wheelStatic(p, x, z) {
  const { u, a } = wheelFrame(x, z);
  const at = (s, w) => [x + u.x * s + a.x * w, z + u.z * s + a.z * w];
  const set = (s, t, w, block) => { const [bx, bz] = at(s, w); p.set(bx, BASE + t, bz, block); };
  p.fill(x - 16, GROUND, z - 16, x + 16, GROUND, z + 16, 'smooth_stone');
  for (let s = -10; s <= 10; s++) for (let w = -4; w <= 4; w++) { const [bx, bz] = at(s, w); p.set(bx, GROUND, bz, (s + w) % 2 ? 'white_concrete' : 'light_gray_concrete'); }
  // A-Boecke links und rechts der Radebene
  for (const w of [-2, 2]) for (const side of [-1, 1]) {
    for (let i = 0; i <= 40; i++) {
      const k = i / 40;
      set(Math.round(side * 9 * (1 - k)), Math.round(17 * k), w, 'white_concrete');
    }
  }
  for (const w of [-2, -1, 1, 2]) set(0, 17, w, 'iron_block');
  // Kassenhaeuschen und Absperrung vorne
  const fw = 7;
  for (let s = -8; s <= -6; s++) for (let t = 0; t <= 2; t++) set(s, t, fw, t === 1 && s === -7 ? 'glass' : 'red_concrete');
  for (let s = -8; s <= -6; s++) set(s, 3, fw, 'yellow_concrete');
  for (let s = -3; s <= 3; s++) set(s, 0, fw, 'oak_fence');
  for (const s of [-10, 10]) { set(s, 0, fw, 'oak_fence'); set(s, 1, fw, 'oak_fence'); set(s, 2, fw, 'lantern'); }
}

/** Teile des Rads in der lokalen Ebene: c = Mitte, psi = Drehung, S = Groesse, upright = Gondel */
function parts() {
  const L = [];
  const segLen = ((2 * Math.PI * WHEEL_R) / RIM) * 1.08;
  for (let k = 0; k < RIM; k++) {
    const phi = (k * 360) / RIM, r = (phi * Math.PI) / 180;
    L.push({ block: k % 2 ? 'white_concrete' : 'yellow_concrete', c: [WHEEL_R * Math.cos(r), WHEEL_R * Math.sin(r), 0], psi: phi + 90, S: [segLen, 0.4, 0.4] });
  }
  for (let k = 0; k < SPOKES; k++) {
    const phi = (k * 360) / SPOKES + 22.5, r = (phi * Math.PI) / 180;
    L.push({ block: 'light_gray_concrete', c: [(WHEEL_R / 2) * Math.cos(r), (WHEEL_R / 2) * Math.sin(r), 0], psi: phi, S: [WHEEL_R, 0.25, 0.25] });
  }
  L.push({ block: 'gold_block', c: [0, 0, 0], psi: 0, S: [1.4, 1.4, 1.4] });
  for (let k = 0; k < GONDOLAS; k++) {
    const phi = (k * 360) / GONDOLAS, r = (phi * Math.PI) / 180, c = [WHEEL_R * Math.cos(r), WHEEL_R * Math.sin(r), 0];
    L.push({ block: `${COLORS[k]}_concrete`, c, hang: [0, -1.3, 0], S: [1.6, 1.2, 1.6], upright: true });
    L.push({ block: 'white_concrete', c, hang: [0, -0.45, 0], S: [1.8, 0.2, 1.8], upright: true });
    L.push({ block: 'light_gray_concrete', c, hang: [0, -0.25, 0], S: [0.12, 0.5, 0.12], upright: true });
  }
  return L;
}

export class Wheel {
  constructor(mc, x, z, log = console.log) {
    this.mc = mc; this.log = log;
    this.x = x + 0.5; this.y = BASE + HUB_T; this.z = z + 0.5;
    this.frame = wheelFrame(x, z);
    this.parts = parts();
    this.angle = 0;
  }

  /** Lage eines Teils beim Drehwinkel theta: Rotation (Quaternion) und Verschiebung */
  pose(part, theta) {
    const { Q0 } = this.frame;
    const spin = qmul(Q0, qz(theta));
    const half = part.S.map((v) => v / 2);
    if (part.upright) {
      const c = qrot(spin, part.c), h = qrot(Q0, part.hang), off = qrot(Q0, half);
      return { q: Q0, t: [c[0] + h[0] - off[0], c[1] + h[1] - off[1], c[2] + h[2] - off[2]] };
    }
    const q = qmul(spin, qz(part.psi));
    const c = qrot(spin, part.c), off = qrot(q, half);
    return { q, t: [c[0] - off[0], c[1] - off[1], c[2] - off[2]] };
  }

  tr(part, theta) {
    const { q, t } = this.pose(part, theta);
    return `transformation:{left_rotation:[${f3(q)}],right_rotation:[0f,0f,0f,1f],translation:[${f3(t)}],scale:[${f3(part.S)}]}`;
  }

  async spawn() {
    const mc = this.mc, r = WHEEL_R + 4;
    await mc.send(`forceload add ${Math.floor(this.x - r)} ${Math.floor(this.z - r)} ${Math.floor(this.x + r)} ${Math.floor(this.z + r)}`);
    await mc.send('kill @e[tag=mc_wheel]');
    for (const [i, p] of this.parts.entries()) {
      await mc.send(`summon block_display ${this.x} ${this.y} ${this.z} {Tags:["mc_wheel","mc_wheel_${i}"],view_range:4f,` +
        `brightness:{sky:15,block:15},block_state:"minecraft:${p.block}",${this.tr(p, this.angle)}}`);
    }
  }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick().catch(() => {}), TICK_MS);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      this.angle = (this.angle + STEP_DEG) % 360;
      for (const [i, p] of this.parts.entries()) {
        await this.mc.send(`data merge entity @e[tag=mc_wheel_${i},limit=1] {start_interpolation:0,interpolation_duration:${Math.round(TICK_MS / 50) + 2},${this.tr(p, this.angle)}}`);
      }
    } finally { this.busy = false; }
  }

  /** Kamera-Position schraeg vor dem Rad */
  cameraSpot() {
    const { f, u } = this.frame, d = 34;
    return { x: this.x + f.dx * d + u.x * 8, y: BASE + 20, z: this.z + f.dz * d + u.z * 8, lx: this.x, ly: this.y - 1, lz: this.z };
  }
}
