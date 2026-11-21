// A tiny hand-drawn renderer for 2D canvases.
//
// Every surface is drawn on three canvases:
//   ink  – blue-pen line art (only alpha is used)
//   wash – watercolour fills on white, multiplied in as the room "colours in"
//   mask – which pixels are paper at all (used for pop-up cut-outs)
// bake() packs them into one RGBA texture: rgb = wash, a = mask ? 0.5 + ink/2 : 0.

import * as THREE from "three";

export type Pt = [number, number];
export type RNG = () => number;

export function rng(seed: number): RNG {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type StrokeOpts = { w?: number; closed?: boolean; rough?: number; alpha?: number; overshoot?: number; mask?: boolean };

export class Sketch {
  readonly S: number;
  readonly r: RNG;
  private ink: CanvasRenderingContext2D;
  private wash: CanvasRenderingContext2D;
  private mask: CanvasRenderingContext2D;
  private k: number;
  fontFamily = "cursive";

  constructor(ink: CanvasRenderingContext2D, wash: CanvasRenderingContext2D, mask: CanvasRenderingContext2D, size: number, seed: number) {
    this.ink = ink;
    this.wash = wash;
    this.mask = mask;
    this.S = size;
    this.r = rng(seed);
    this.k = size / 768;
  }

  private px([x, y]: Pt): Pt {
    return [x * this.S, y * this.S];
  }

  /** Wobbly polyline through normalised points. */
  stroke(points: Pt[], o: StrokeOpts = {}) {
    const { w = 2.6, closed = false, rough = 1, alpha = 1, overshoot = 0.02, mask = false } = o;
    const pts = points.map((p) => this.px(p));
    if (closed) pts.push(pts[0]);
    const c = this.ink;
    const ph1 = this.r() * 100;
    const ph2 = this.r() * 100;
    const amp = 1.5 * rough * this.k;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = "#000";
    c.lineCap = "round";
    c.lineJoin = "round";
    const path: Pt[] = [];
    let dist = 0;
    for (let s = 0; s < pts.length - 1; s++) {
      const [x1, y1] = pts[s];
      const [x2, y2] = pts[s + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const n = Math.max(2, Math.ceil(len / (7 * this.k)));
      const t0 = s === 0 && !closed ? -overshoot : 0;
      const t1 = s === pts.length - 2 && !closed ? 1 + overshoot : 1;
      for (let j = 0; j <= n; j++) {
        const t = t0 + ((t1 - t0) * j) / n;
        const d = dist + t * len;
        const off = amp * (0.6 * Math.sin(ph1 + d * 0.045 / this.k) + 0.4 * Math.sin(ph2 + d * 0.13 / this.k));
        path.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
      }
      dist += len;
    }
    const lw = w * this.k * (0.9 + this.r() * 0.25);
    const trace = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    };
    trace(c);
    c.lineWidth = lw;
    c.stroke();
    c.restore();
    if (mask) {
      const m = this.mask;
      m.save();
      m.strokeStyle = "#fff";
      m.lineCap = "round";
      m.lineJoin = "round";
      m.lineWidth = lw * 2.5;
      trace(m);
      m.stroke();
      m.restore();
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, o: StrokeOpts = {}) {
    this.stroke(
      [
        [x1, y1],
        [x2, y2],
      ],
      o,
    );
  }

  rectPts(x: number, y: number, w: number, h: number): Pt[] {
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }

  ellipsePts(cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2, n = 40): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return out;
  }

  rect(x: number, y: number, w: number, h: number, o: StrokeOpts = {}) {
    this.stroke(this.rectPts(x, y, w, h), { ...o, closed: true });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, o: StrokeOpts = {}) {
    // hand-drawn circles overlap a little where they close
    const start = this.r() * Math.PI * 2;
    this.stroke(this.ellipsePts(cx, cy, rx, ry, start, start + Math.PI * 2.08), { ...o, overshoot: 0 });
  }

  circle(cx: number, cy: number, rad: number, o: StrokeOpts = {}) {
    this.ellipse(cx, cy, rad, rad, o);
  }

  /** Watercolour fill (multiplied over white), slightly mis-registered from the ink. */
  fill(points: Pt[], color: string, opts: { alpha?: number; mask?: boolean; jitter?: number } = {}) {
    const { alpha = 0.9, mask = false, jitter = 1 } = opts;
    const ox = (this.r() - 0.5) * 7 * this.k * jitter;
    const oy = (this.r() - 0.5) * 7 * this.k * jitter;
    const c = this.wash;
    c.save();
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    points.forEach((p, i) => {
      const [x, y] = this.px(p);
      if (i) c.lineTo(x + ox, y + oy);
      else c.moveTo(x + ox, y + oy);
    });
    c.closePath();
    c.fill();
    // pooled pigment at the edge
    c.globalAlpha = alpha * 0.35;
    c.strokeStyle = color;
    c.lineWidth = 5 * this.k;
    c.stroke();
    c.restore();
    if (mask) this.maskFill(points);
  }

  maskFill(points: Pt[]) {
    const c = this.mask;
    c.save();
    c.fillStyle = "#fff";
    c.beginPath();
    points.forEach((p, i) => {
      const [x, y] = this.px(p);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.closePath();
    c.fill();
    c.lineWidth = 4 * this.k;
    c.strokeStyle = "#fff";
    c.stroke();
    c.restore();
  }

  maskAll() {
    this.mask.fillStyle = "#fff";
    this.mask.fillRect(0, 0, this.S, this.S);
  }

  /** Fill + outline in one go. mask=true makes it part of a pop-up's silhouette. */
  shape(points: Pt[], color: string | null, o: StrokeOpts & { mask?: boolean; alpha?: number } = {}) {
    if (color) this.fill(points, color, { mask: o.mask, alpha: o.alpha ?? 0.9 });
    else if (o.mask) this.maskFill(points);
    this.stroke(points, { ...o, alpha: 1, closed: true });
  }

  box(x: number, y: number, w: number, h: number, color: string | null, o: StrokeOpts & { mask?: boolean } = {}) {
    this.shape(this.rectPts(x, y, w, h), color, o);
  }

  blob(cx: number, cy: number, rx: number, ry: number, color: string | null, o: StrokeOpts & { mask?: boolean } = {}) {
    if (color) this.fill(this.ellipsePts(cx, cy, rx, ry), color, { mask: o.mask });
    else if (o.mask) this.maskFill(this.ellipsePts(cx, cy, rx, ry));
    this.ellipse(cx, cy, rx, ry, o);
  }

  /** Parallel pen hatching clipped to a polygon. */
  hatch(points: Pt[], spacing = 0.02, angle = -0.6, w = 1.4, alpha = 0.55) {
    const c = this.ink;
    c.save();
    c.beginPath();
    points.forEach((p, i) => {
      const [x, y] = this.px(p);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.closePath();
    c.clip();
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs) - 0.3;
    const maxX = Math.max(...xs) + 0.3;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = Math.cos(angle) * (maxY - minY + 0.6);
    const dy = Math.sin(angle) * (maxY - minY + 0.6);
    for (let x = minX; x < maxX; x += spacing) {
      this.stroke(
        [
          [x, maxY + 0.3],
          [x + dx, maxY + 0.3 + dy],
        ],
        { w, alpha, rough: 0.7 },
      );
    }
    c.restore();
  }

  /** Dense back-and-forth scribble, like a pen colouring something in. */
  scribble(points: Pt[], density = 0.012, w = 1.6) {
    const c = this.ink;
    c.save();
    c.beginPath();
    points.forEach((p, i) => {
      const [x, y] = this.px(p);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.closePath();
    c.clip();
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs) - 0.02;
    const maxX = Math.max(...xs) + 0.02;
    const minY = Math.min(...ys) - 0.02;
    const maxY = Math.max(...ys) + 0.02;
    const zig: Pt[] = [];
    let flip = false;
    for (let y = minY; y < maxY; y += density) {
      zig.push(flip ? [maxX, y + density * 0.7] : [minX, y]);
      flip = !flip;
    }
    this.stroke(zig, { w, rough: 1.4, alpha: 0.85 });
    c.restore();
  }

  text(str: string, x: number, y: number, size: number, o: { align?: CanvasTextAlign; weight?: number; rotate?: number } = {}) {
    const c = this.ink;
    c.save();
    c.fillStyle = "#000";
    c.textAlign = o.align ?? "center";
    c.textBaseline = "middle";
    c.font = `${o.weight ?? 700} ${size * this.S}px ${this.fontFamily}`;
    const [px, py] = this.px([x, y]);
    c.translate(px, py);
    c.rotate(o.rotate ?? 0);
    c.fillText(str, 0, 0);
    c.restore();
  }

  /** Watercolour wash over the whole sheet. */
  washAll(color: string, alpha = 0.85) {
    this.fill(this.rectPts(-0.02, -0.02, 1.04, 1.04), color, { alpha, jitter: 0 });
  }
}

// ---------------------------------------------------------------------------

type Scratch = { ink: HTMLCanvasElement; wash: HTMLCanvasElement; mask: HTMLCanvasElement };
const scratch = new Map<number, Scratch>();

function getScratch(size: number): Scratch {
  let s = scratch.get(size);
  if (!s) {
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      return c;
    };
    s = { ink: mk(), wash: mk(), mask: mk() };
    scratch.set(size, s);
  }
  return s;
}

/**
 * Draw a surface and pack it into a single texture.
 * full=true marks every pixel as paper (walls, floors); pop-ups leave it to their shapes.
 */
export function bake(size: number, seed: number, font: string, full: boolean, draw: (s: Sketch) => void): THREE.DataTexture {
  const sc = getScratch(size);
  const ink = sc.ink.getContext("2d", { willReadFrequently: true })!;
  const wash = sc.wash.getContext("2d", { willReadFrequently: true })!;
  const mask = sc.mask.getContext("2d", { willReadFrequently: true })!;
  ink.clearRect(0, 0, size, size);
  mask.clearRect(0, 0, size, size);
  wash.globalCompositeOperation = "source-over";
  wash.globalAlpha = 1;
  wash.fillStyle = "#fff";
  wash.fillRect(0, 0, size, size);

  const s = new Sketch(ink, wash, mask, size, seed);
  s.fontFamily = font;
  if (full) s.maskAll();
  draw(s);

  const I = ink.getImageData(0, 0, size, size).data;
  const W = wash.getImageData(0, 0, size, size).data;
  const M = mask.getImageData(0, 0, size, size).data;
  const out = new Uint8Array(size * size * 4);
  // DataTextures are not flipped on upload, so flip rows here (canvas y-down → uv v-up).
  for (let y = 0; y < size; y++) {
    const src = y * size * 4;
    const dst = (size - 1 - y) * size * 4;
    for (let x = 0; x < size * 4; x += 4) {
      const i = src + x;
      const o = dst + x;
      out[o] = W[i];
      out[o + 1] = W[i + 1];
      out[o + 2] = W[i + 2];
      out[o + 3] = M[i + 3] > 127 ? 128 + (I[i + 3] >> 1) : 0;
    }
  }
  const tex = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
