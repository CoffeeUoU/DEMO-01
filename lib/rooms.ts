// The six rooms, drawn with the hand-drawn Sketch renderer.
//
// Canvas conventions (all coordinates are 0..1, y grows downwards):
//   left wall  – the room's corner is at x = 1, the floor at y = 1
//   right wall – the room's corner is at x = 0, the floor at y = 1
//   floor      – the corner is bottom-left (0, 1); the right wall runs along the bottom
//                edge, the left wall up the left edge; the corner nearest you is top-right
//   pop-ups    – a square card standing on its bottom edge (y = 1)
//
// Pop-up positions are [s, t]: s = distance along the right wall, t = along the left wall.

import type { Pt, Sketch } from "./sketch";
import { isoLayers, WHITE, SIDE_A, SIDE_B } from "./iso";

export type PopUp = { size: number; at: [number, number]; draw: (s: Sketch) => void; halo?: number };
export type Room = {
  name: string;
  mood: string;
  left: (s: Sketch) => void;
  right: (s: Sketch) => void;
  floor: (s: Sketch) => void;
  popups: PopUp[];
};

const F = (a: number, b: number): Pt => [a, 1 - b]; // floor coords → canvas

function baseboard(s: Sketch, color = "#e9dfcf") {
  s.box(-0.02, 0.93, 1.04, 0.09, color, { w: 2.2 });
}

function planks(s: Sketch, color: string, n = 7, alongRight = true) {
  s.washAll(color, 0.8);
  for (let i = 1; i < n; i++) {
    const v = i / n;
    if (alongRight) s.line(0, 1 - v, 1, 1 - v, { w: 1.8, alpha: 0.6 });
    else s.line(v, 0, v, 1, { w: 1.8, alpha: 0.6 });
    // staggered plank joints
    for (let j = 0; j < 2; j++) {
      const p = (s.r() * 0.8 + 0.1) as number;
      if (alongRight) s.line(p, 1 - v, p, 1 - v + 1 / n, { w: 1.4, alpha: 0.5 });
      else s.line(v, p, v + 1 / n, p, { w: 1.4, alpha: 0.5 });
    }
  }
}

function tiles(s: Sketch, n: number, alpha = 0.45) {
  for (let i = 1; i < n; i++) {
    s.line(i / n, 0, i / n, 1, { w: 1.3, alpha });
    s.line(0, i / n, 1, i / n, { w: 1.3, alpha });
  }
}

function frame(s: Sketch, x: number, y: number, w: number, h: number, inner: string, doodle?: (s: Sketch) => void) {
  s.box(x, y, w, h, "#fbf6ea", { w: 2.4 });
  s.box(x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76, inner, { w: 1.6 });
  doodle?.(s);
}

function plant(s: Sketch, cx: number, by: number, sc: number, pot = "#e9a07c", mask = false) {
  s.shape(
    [
      [cx - 0.09 * sc, by - 0.16 * sc],
      [cx + 0.09 * sc, by - 0.16 * sc],
      [cx + 0.065 * sc, by],
      [cx - 0.065 * sc, by],
    ],
    pot,
    { mask },
  );
  const leaves: [number, number, number][] = [
    [-0.08, -0.32, -0.6],
    [0.0, -0.4, 0],
    [0.08, -0.3, 0.6],
    [-0.12, -0.22, -1],
    [0.12, -0.22, 1],
  ];
  for (const [dx, dy, rot] of leaves) {
    const lx = cx + dx * sc;
    const ly = by + dy * sc;
    const pts = s.ellipsePts(0, 0, 0.035 * sc, 0.085 * sc).map(([x, y]) => [lx + x * Math.cos(rot) - y * Math.sin(rot), ly + x * Math.sin(rot) + y * Math.cos(rot)] as Pt);
    s.shape(pts, "#a9d39a", { mask, w: 1.8 });
    s.line(cx, by - 0.16 * sc, lx, ly, { w: 1.4, alpha: 0.8, mask });
  }
}

function fairyLights(s: Sketch, x1: number, x2: number, y: number, sag = 0.06) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push([x1 + (x2 - x1) * t, y + Math.sin(t * Math.PI * 3) ** 2 * sag]);
  }
  s.stroke(pts, { w: 1.6 });
  for (let i = 1; i < 20; i += 2) {
    const [x, yy] = pts[i];
    s.blob(x, yy + 0.022, 0.011, 0.016, "#ffe08a", { w: 1.4 });
  }
}

// ---------------------------------------------------------------------------

// Bedroom — blue ink on white paper, everything a cut-out sticker (after the reference sketch).

function curtain(s: Sketch, x0: number, x1: number, top: number, bottom: number) {
  const folds = 4;
  const w = x1 - x0;
  const pts: Pt[] = [[x0, top]];
  pts.push([x1, top]);
  // scalloped hem
  const hem: Pt[] = [];
  for (let i = 0; i <= folds * 2; i++) hem.push([x1 - (w * i) / (folds * 2), bottom + (i % 2 ? 0.012 : -0.004)]);
  const shape: Pt[] = [...pts, ...hem];
  s.sticker(shape, 6);
  s.stroke(shape, { closed: true, w: 2.4 });
  for (let i = 1; i < folds; i++) {
    const x = x0 + (w * i) / folds;
    s.stroke(
      [
        [x, top + 0.02],
        [x + 0.006, (top + bottom) / 2],
        [x - 0.002, bottom - 0.01],
      ],
      { w: 1.5, alpha: 0.8 },
    );
  }
  s.line(x0 + 0.005, bottom - 0.02, x1 - 0.005, bottom - 0.02, { w: 1.1, alpha: 0.55 });
  // gathered rings at the top
  for (let i = 0; i < folds; i++) s.blob(x0 + (w * (i + 0.5)) / folds, top, w / folds / 2.1, 0.018, WHITE, { w: 1.8 });
}

function cloud(s: Sketch, cx: number, cy: number, r: number, hatch = false) {
  const pts: Pt[] = [];
  const bumps = [
    [-1.6, 0, 0.55],
    [-0.7, -0.45, 0.7],
    [0.4, -0.55, 0.8],
    [1.35, -0.1, 0.55],
  ];
  pts.push([cx - 2.1 * r, cy + 0.3 * r]);
  for (const [bx, by, br] of bumps) {
    const c: Pt = [cx + bx * r, cy + by * r];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      pts.push([c[0] + Math.cos(a) * br * r, c[1] + Math.sin(a) * br * r]);
    }
  }
  pts.push([cx + 2.0 * r, cy + 0.3 * r]);
  s.stroke(pts, { w: 1.8 });
  if (hatch) s.hatch([...pts, [cx + 2.0 * r, cy + 1.2 * r], [cx - 2.1 * r, cy + 1.2 * r]], 0.012, -0.9, 1.1, 0.6);
}

function tapedPhoto(s: Sketch, x: number, y: number, w: number, h: number, rot = 0, doodle: "face" | "mountain" = "face") {
  const c: Pt = [x + w / 2, y + h / 2];
  const R = (p: Pt): Pt => {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    return [c[0] + dx * Math.cos(rot) - dy * Math.sin(rot), c[1] + dx * Math.sin(rot) + dy * Math.cos(rot)];
  };
  const outer = s.rectPts(x, y, w, h).map(R);
  s.sticker(outer, 4);
  s.stroke(outer, { closed: true, w: 2.2 });
  const m = Math.min(w, h) * 0.12;
  const inner = s.rectPts(x + m, y + m, w - 2 * m, h - 2 * m).map(R);
  s.stroke(inner, { closed: true, w: 1.4 });
  if (doodle === "face") {
    const [hx, hy] = R([x + w / 2, y + h * 0.42]);
    s.circle(hx, hy, w * 0.13, { w: 1.6 });
    s.stroke(s.ellipsePts(x + w / 2, y + h * 0.88, w * 0.26, h * 0.24, Math.PI, Math.PI * 2, 12).map(R), { w: 1.6 });
  } else {
    s.stroke(
      [
        [x + m, y + h - m * 1.6],
        [x + w * 0.38, y + h * 0.45],
        [x + w * 0.55, y + h * 0.62],
        [x + w * 0.7, y + h * 0.5],
        [x + w - m, y + h - m * 1.6],
      ].map((p) => R(p as Pt)),
      { w: 1.6 },
    );
    const [sx, sy] = R([x + w * 0.7, y + h * 0.3]);
    s.circle(sx, sy, w * 0.07, { w: 1.4 });
    s.line(...R([x + m, y + h - m * 1.2]), ...R([x + w - m, y + h - m * 1.2]), { w: 1.2, alpha: 0.6 });
  }
  // tape strips
  for (const t of [R([x + w / 2, y - 0.004])]) {
    const tw = w * 0.35;
    const tp = s.rectPts(t[0] - tw / 2, t[1] - 0.012, tw, 0.024);
    s.fill(tp, "#e9e7f3", { alpha: 0.9, jitter: 0 });
    s.stroke(tp, { closed: true, w: 1.1, alpha: 0.7 });
  }
}

const bedroom: Room = {
  name: "bedroom",
  mood: "slow mornings, late-night thinking",
  left(s) {
    // window
    const win = s.rectPts(0.22, 0.2, 0.46, 0.42);
    s.sticker(win, 8);
    s.box(0.22, 0.2, 0.46, 0.42, null, { w: 3 });
    s.rect(0.245, 0.225, 0.41, 0.37, { w: 1.8 });
    s.line(0.45, 0.225, 0.45, 0.595, { w: 2.6 });
    s.line(0.245, 0.41, 0.655, 0.41, { w: 2.6 });
    s.box(0.2, 0.615, 0.5, 0.022, null, { w: 2.2 });
    cloud(s, 0.31, 0.31, 0.025);
    cloud(s, 0.56, 0.29, 0.03);
    cloud(s, 0.33, 0.54, 0.035, true);
    cloud(s, 0.57, 0.5, 0.032, true);
    for (const [x, y] of [
      [0.27, 0.25],
      [0.48, 0.44],
    ]) {
      s.line(x, y + 0.04, x + 0.03, y, { w: 1.2, alpha: 0.6 });
      s.line(x + 0.015, y + 0.06, x + 0.05, y + 0.015, { w: 1.2, alpha: 0.6 });
    }
    // curtain rod + curtains
    s.line(0.15, 0.165, 0.76, 0.165, { w: 2.6 });
    s.blob(0.145, 0.165, 0.008, 0.01, WHITE, { w: 1.6 });
    s.blob(0.765, 0.165, 0.008, 0.01, WHITE, { w: 1.6 });
    curtain(s, 0.15, 0.27, 0.165, 0.66);
    curtain(s, 0.63, 0.76, 0.165, 0.66);
    // stars near the corner
    s.star(0.88, 0.22, 0.026, { w: 2 });
    s.star(0.92, 0.33, 0.016, { w: 1.8 });
    s.star(0.84, 0.4, 0.012, { w: 1.6 });
    // taped photos near the front edge
    tapedPhoto(s, 0.03, 0.4, 0.08, 0.1, -0.05);
    tapedPhoto(s, 0.035, 0.55, 0.085, 0.1, 0.04);
  },
  right(s) {
    // stars
    s.star(0.14, 0.12, 0.016);
    s.star(0.2, 0.17, 0.022);
    // taped poster
    tapedPhoto(s, 0.08, 0.22, 0.15, 0.2, 0.02, "mountain");
    // shelf + books
    const shelf = s.rectPts(0.4, 0.3, 0.5, 0.026);
    s.sticker(shelf, 4);
    s.box(0.4, 0.3, 0.5, 0.026, null, { w: 2.2 });
    s.stroke(
      [
        [0.47, 0.326],
        [0.47, 0.36],
        [0.5, 0.326],
      ],
      { w: 1.6 },
    );
    s.stroke(
      [
        [0.83, 0.326],
        [0.83, 0.36],
        [0.86, 0.326],
      ],
      { w: 1.6 },
    );
    const books: [number, number, number][] = [
      [0.66, 0.03, 0.13],
      [0.692, 0.028, 0.12],
      [0.722, 0.034, 0.14],
      [0.758, 0.03, 0.11],
    ];
    for (const [x, w, h] of books) {
      const b = s.rectPts(x, 0.3 - h, w, h);
      s.sticker(b, 2, 0.12);
      s.stroke(b, { closed: true, w: 1.8 });
      s.line(x + w * 0.2, 0.3 - h + 0.02, x + w * 0.8, 0.3 - h + 0.02, { w: 1, alpha: 0.6 });
    }
    const box = s.rectPts(0.8, 0.25, 0.08, 0.05);
    s.sticker(box, 3, 0.12);
    s.stroke(box, { closed: true, w: 1.8 });
    s.line(0.8, 0.265, 0.88, 0.265, { w: 1.2 });
    // trailing plant on the shelf
    const pot: Pt[] = [
      [0.44, 0.24],
      [0.54, 0.24],
      [0.525, 0.3],
      [0.455, 0.3],
    ];
    s.sticker(pot, 3, 0.15);
    s.stroke(pot, { closed: true, w: 2 });
    const leaf = (x: number, y: number, r: number, rot: number) => {
      const almond: Pt[] = [];
      for (let i = 0; i <= 8; i++) almond.push([Math.sin((i / 8) * Math.PI) * r * 0.55, -r + (2 * r * i) / 8]);
      for (let i = 8; i >= 0; i--) almond.push([-Math.sin((i / 8) * Math.PI) * r * 0.55, -r + (2 * r * i) / 8]);
      const pts = almond.map(([a, b]) => [x + a * Math.cos(rot) - b * Math.sin(rot), y + a * Math.sin(rot) + b * Math.cos(rot)] as Pt);
      s.sticker(pts, 2, 0.12);
      s.stroke(pts, { closed: true, w: 1.6 });
      s.line(x - Math.sin(rot) * r * -0.8, y + Math.cos(rot) * r * -0.8, x - Math.sin(rot) * r * 0.8, y + Math.cos(rot) * r * 0.8, { w: 1, alpha: 0.7 });
    };
    const vines: [number, number][][] = [
      [
        [0.45, 0.25],
        [0.4, 0.3],
        [0.38, 0.38],
        [0.39, 0.46],
      ],
      [
        [0.48, 0.25],
        [0.44, 0.33],
        [0.44, 0.4],
      ],
      [
        [0.52, 0.24],
        [0.55, 0.2],
        [0.5, 0.16],
      ],
      [
        [0.47, 0.24],
        [0.45, 0.17],
        [0.4, 0.15],
      ],
    ];
    vines.forEach((v, i) => {
      s.stroke(v, { w: 1.4 });
      for (let j = 0; j < v.length - 1; j++)
        for (const t of [0.35, 0.85]) {
          const x = v[j][0] + (v[j + 1][0] - v[j][0]) * t;
          const y = v[j][1] + (v[j + 1][1] - v[j][1]) * t;
          const sideways = (j + (t > 0.5 ? 1 : 0)) % 2 ? 1 : -1;
          leaf(x + sideways * 0.018, y, 0.026, sideways * 0.9 + i * 0.1);
        }
    });
    // cork board with pinned notes
    const board = s.rectPts(0.55, 0.37, 0.36, 0.22);
    s.sticker(board, 5);
    s.box(0.55, 0.37, 0.36, 0.22, null, { w: 2.6 });
    s.rect(0.565, 0.385, 0.33, 0.19, { w: 1.2, alpha: 0.6 });
    for (let i = 0; i < 40; i++) s.circle(0.57 + s.r() * 0.32, 0.39 + s.r() * 0.18, 0.002, { w: 1, alpha: 0.5 });
    const note = (x: number, y: number, w: number, h: number, lines: number, rot = 0) => {
      const c: Pt = [x + w / 2, y + h / 2];
      const pts = s.rectPts(x, y, w, h).map(([px, py]) => [c[0] + (px - c[0]) * Math.cos(rot) - (py - c[1]) * Math.sin(rot), c[1] + (px - c[0]) * Math.sin(rot) + (py - c[1]) * Math.cos(rot)] as Pt);
      s.sticker(pts, 2, 0.15);
      s.stroke(pts, { closed: true, w: 1.6 });
      for (let i = 0; i < lines; i++) s.line(x + w * 0.18, y + h * (0.35 + i * 0.18), x + w * 0.82, y + h * (0.35 + i * 0.18), { w: 1, alpha: 0.6 });
      s.blob(x + w / 2, y + 0.006, 0.006, 0.006, "#d9d6ec", { w: 1.3 });
    };
    note(0.59, 0.4, 0.07, 0.09, 3, -0.06);
    note(0.68, 0.405, 0.1, 0.075, 0, 0.02);
    s.stroke(
      [
        [0.69, 0.47],
        [0.715, 0.43],
        [0.735, 0.455],
        [0.75, 0.44],
        [0.77, 0.47],
      ],
      { w: 1.3 },
    );
    note(0.8, 0.395, 0.08, 0.09, 3, 0.05);
    note(0.62, 0.5, 0.06, 0.06, 2, 0.08);
    note(0.71, 0.5, 0.06, 0.06, 0, -0.04);
    s.circle(0.74, 0.535, 0.012, { w: 1.2 });
    note(0.8, 0.5, 0.07, 0.06, 2, -0.03);
  },
  floor(s) {
    // floor boards running away from the left wall
    for (let i = 1; i < 9; i++) {
      const v = i / 9;
      s.line(0, 1 - v, 1, 1 - v, { w: 1.5, alpha: 0.55 });
      for (let j = 0; j < 2; j++) {
        const p = s.r() * 0.8 + 0.1;
        s.line(p, 1 - v, p, 1 - v + 1 / 9, { w: 1.2, alpha: 0.45 });
      }
    }
    // contact shadows under the furniture (coords: F(xa, xb))
    const quad = (x: number, y: number, dx: number, dy: number) => [F(x, y), F(x + dx, y), F(x + dx, y + dy), F(x, y + dy)];
    s.shadow(quad(0.03, 0.27, 0.36, 0.62), 0.28, 16);
    s.shadow(quad(0.42, 0.02, 0.56, 0.27), 0.22, 16);
    s.shadow(quad(0.52, 0.3, 0.18, 0.16), 0.2, 12);
    s.shadow(s.ellipsePts(0.9, 1 - 0.36, 0.05, 0.05), 0.2, 8);
    // rug with a scalloped edge
    const rx0 = 0.46;
    const rx1 = 0.88;
    const ry0 = 0.46;
    const ry1 = 0.88;
    const rug = [F(rx0, ry0), F(rx1, ry0), F(rx1, ry1), F(rx0, ry1)];
    s.sticker(rug, 4, 0.16);
    const edge: Pt[] = [];
    const side = (a: Pt, b: Pt) => {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const tm = (i + 0.5) / n;
        const x = a[0] + (b[0] - a[0]) * t0;
        const y = a[1] + (b[1] - a[1]) * t0;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        edge.push([x, y]);
        edge.push([a[0] + dx * tm + (dy / len) * 0.012, a[1] + dy * tm - (dx / len) * 0.012]);
      }
    };
    for (let i = 0; i < 4; i++) side(rug[i], rug[(i + 1) % 4]);
    s.stroke(edge, { closed: true, w: 2 });
    for (let i = 0; i < 26; i++) {
      const x = rx0 + 0.04 + s.r() * (rx1 - rx0 - 0.08);
      const y = ry0 + 0.04 + s.r() * (ry1 - ry0 - 0.08);
      const [px, py] = F(x, y);
      s.line(px, py, px + 0.008, py - 0.008, { w: 1.1, alpha: 0.5 });
    }
    // slippers
    for (const dx of [0, 0.075]) {
      const cx = 0.6 + dx;
      const cy = 1 - 0.7;
      const sl = s.ellipsePts(cx, cy, 0.03, 0.06);
      s.sticker(sl, 3, 0.2);
      s.stroke(sl, { closed: true, w: 2 });
      s.stroke(s.ellipsePts(cx, cy + 0.015, 0.022, 0.035, Math.PI * 1.05, Math.PI * 1.95, 10), { w: 1.6 });
    }
  },
  popups: isoLayers([
    // against the walls: bed + desk
    (iso) => {
      // --- desk (against the right wall) ---
      const DZ = 0.36;
      // far leg pair at the left end
      iso.box(0.43, 0.03, 0, 0.025, 0.025, DZ - 0.02);
      // drawer unit at the right end
      iso.box(0.76, 0.03, 0, 0.19, 0.22, DZ - 0.02);
      for (let i = 0; i < 3; i++) {
        const z0 = 0.03 + i * 0.105;
        iso.face(
          [
            [0.775, 0.25, z0],
            [0.935, 0.25, z0],
            [0.935, 0.25, z0 + 0.085],
            [0.775, 0.25, z0 + 0.085],
          ],
          null,
          { w: 1.6 },
        );
        iso.line([0.835, 0.25, z0 + 0.045], [0.875, 0.25, z0 + 0.045], { w: 2.2 });
      }
      iso.box(0.43, 0.22, 0, 0.025, 0.025, DZ - 0.02);
      // desk top
      iso.box(0.41, 0.02, DZ - 0.025, 0.56, 0.27, 0.025, WHITE);
      const T = DZ;
      // lamp
      iso.cyl(0.47, 0.07, T, 0.035, 0.012);
      iso.path(
        [
          [0.47, 0.07, T + 0.012],
          [0.47, 0.07, T + 0.14],
          [0.53, 0.1, T + 0.2],
        ],
        { w: 2.4 },
      );
      iso.cyl(0.55, 0.11, T + 0.12, 0.05, 0.07, WHITE, { r2: 0.018 });
      iso.at([0.56, 0.12, T + 0.1], (s, [x, y], u) => {
        for (let i = 0; i < 4; i++) {
          const a = 0.5 + i * 0.55;
          s.line(x + Math.cos(a) * 0.08 * u, y + Math.sin(a) * 0.08 * u, x + Math.cos(a) * 0.12 * u, y + Math.sin(a) * 0.12 * u, { w: 1.4, mask: true });
        }
      });
      // laptop
      iso.box(0.6, 0.06, T, 0.16, 0.12, 0.01);
      iso.face(
        [
          [0.6, 0.06, T + 0.01],
          [0.76, 0.06, T + 0.01],
          [0.76, 0.035, T + 0.13],
          [0.6, 0.035, T + 0.13],
        ],
        WHITE,
        { w: 2.2 },
      );
      iso.face(
        [
          [0.615, 0.057, T + 0.025],
          [0.745, 0.057, T + 0.025],
          [0.745, 0.039, T + 0.115],
          [0.615, 0.039, T + 0.115],
        ],
        null,
        { w: 1.3 },
      );
      // mug, pencil cup, books
      iso.cyl(0.8, 0.2, T, 0.028, 0.05);
      iso.at([0.83, 0.2, T + 0.03], (s, [x, y], u) => s.stroke(s.ellipsePts(x, y, 0.018 * u, 0.022 * u, -1.3, 1.3, 8), { w: 2, mask: true }));
      iso.cyl(0.87, 0.1, T, 0.03, 0.07);
      for (const [dx, dy] of [
        [-0.01, 0],
        [0.008, -0.01],
        [0.004, 0.012],
      ])
        iso.line([0.87 + dx, 0.1 + dy, T + 0.07], [0.87 + dx * 2.5, 0.1 + dy * 2.5, T + 0.13], { w: 2 });
      iso.box(0.9, 0.18, T, 0.035, 0.08, 0.1);

      // --- bed (against the left wall), kept simple ---
      const B0 = 0.28;
      const B1 = 0.87;
      iso.box(0.03, B0, 0, 0.34, B1 - B0, 0.08);
      iso.box(0.03, B0, 0.08, 0.34, B1 - B0, 0.09);
      // pillow
      iso.box(0.08, 0.31, 0.17, 0.24, 0.1, 0.04);
      // quilt over the front part with a folded-back edge
      const Q0 = 0.46;
      iso.box(0.025, Q0, 0.06, 0.35, B1 + 0.01 - Q0, 0.115);
      iso.box(0.025, Q0, 0.175, 0.35, 0.06, 0.008);
    },
    // loose pieces: chair, bin
    (iso) => {
      // chair, back to us, tucked at the desk
      const cx = 0.53;
      const cy = 0.3;
      for (const [lx, ly] of [
        [cx + 0.01, cy + 0.01],
        [cx + 0.125, cy + 0.01],
        [cx + 0.01, cy + 0.125],
        [cx + 0.125, cy + 0.125],
      ])
        iso.line([lx, ly, 0], [lx, ly, 0.19], { w: 2.4 });
      iso.box(cx, cy, 0.19, 0.15, 0.15, 0.02);
      iso.line([cx + 0.01, cy + 0.14, 0.21], [cx + 0.01, cy + 0.14, 0.33], { w: 2.4 });
      iso.line([cx + 0.14, cy + 0.14, 0.21], [cx + 0.14, cy + 0.14, 0.33], { w: 2.4 });
      iso.box(cx, cy + 0.13, 0.33, 0.15, 0.02, 0.08);
      // waste bin with a woven pattern
      iso.cyl(0.9, 0.36, 0, 0.045, 0.1, WHITE, { r2: 0.052 });
      iso.at([0.9, 0.36, 0.05], (s, [x, y], u) => {
        for (let i = -2; i <= 2; i++) {
          s.line(x + (i * 0.018 - 0.02) * u, y - 0.045 * u, x + (i * 0.018 + 0.02) * u, y + 0.045 * u, { w: 1, alpha: 0.7, mask: true });
          s.line(x + (i * 0.018 + 0.02) * u, y - 0.045 * u, x + (i * 0.018 - 0.02) * u, y + 0.045 * u, { w: 1, alpha: 0.7, mask: true });
        }
      });
    },
  ]),
};

const bathroom: Room = {
  name: "bathroom",
  mood: "resets, mirror talks",
  left(s) {
    s.washAll("#cfeee4");
    s.box(-0.02, 0.5, 1.04, 0.52, "#f4fbf8", { w: 2 });
    for (let i = 1; i < 10; i++) s.line(i / 10, 0.5, i / 10, 1, { w: 1.2, alpha: 0.45 });
    for (let j = 1; j < 5; j++) s.line(0, 0.5 + j * 0.1, 1, 0.5 + j * 0.1, { w: 1.2, alpha: 0.45 });
    // round mirror
    s.blob(0.42, 0.28, 0.15, 0.15, "#e3eefa", { w: 3 });
    s.line(0.35, 0.2, 0.42, 0.14, { w: 1.4, alpha: 0.6 });
    s.line(0.36, 0.26, 0.47, 0.17, { w: 1.4, alpha: 0.6 });
    // sink
    s.shape(
      [
        [0.24, 0.5],
        [0.6, 0.5],
        [0.56, 0.6],
        [0.28, 0.6],
      ],
      "#ffffff",
      { w: 2.8 },
    );
    s.box(0.38, 0.6, 0.08, 0.34, "#ffffff", { w: 2.4 });
    s.stroke(
      [
        [0.42, 0.5],
        [0.42, 0.45],
        [0.47, 0.45],
      ],
      { w: 2.4 },
    );
    // toothbrush cup
    s.box(0.27, 0.43, 0.045, 0.07, "#f6b2a0", { w: 2 });
    s.line(0.285, 0.43, 0.275, 0.37, { w: 1.8 });
    s.line(0.3, 0.43, 0.31, 0.38, { w: 1.8 });
    // towel ring
    s.circle(0.78, 0.36, 0.05, { w: 2.4 });
    s.shape(
      [
        [0.73, 0.38],
        [0.83, 0.38],
        [0.85, 0.6],
        [0.71, 0.6],
      ],
      "#f6b2a0",
      { w: 2.4 },
    );
    s.line(0.72, 0.55, 0.84, 0.55, { w: 1.4, alpha: 0.7 });
  },
  right(s) {
    s.washAll("#cfeee4");
    s.box(0.04, 0.04, 0.6, 0.98, "#f4fbf8", { w: 2.2 });
    for (let i = 1; i < 6; i++) s.line(0.04 + i * 0.1, 0.04, 0.04 + i * 0.1, 1, { w: 1.2, alpha: 0.45 });
    for (let j = 1; j < 10; j++) s.line(0.04, 0.04 + j * 0.1, 0.64, 0.04 + j * 0.1, { w: 1.2, alpha: 0.45 });
    // shower pipe + head
    s.stroke(
      [
        [0.12, 0.6],
        [0.12, 0.14],
        [0.24, 0.14],
      ],
      { w: 3 },
    );
    s.shape(
      [
        [0.2, 0.14],
        [0.32, 0.14],
        [0.29, 0.19],
        [0.23, 0.19],
      ],
      "#d8dde6",
      { w: 2.4 },
    );
    for (let i = 0; i < 6; i++) s.line(0.24 + i * 0.01, 0.22, 0.21 + i * 0.02, 0.4 + (i % 2) * 0.04, { w: 1.2, alpha: 0.5 });
    // curtain rod + coral curtain
    s.line(0.04, 0.08, 0.7, 0.08, { w: 3 });
    s.shape(
      [
        [0.42, 0.08],
        [0.69, 0.08],
        [0.71, 0.86],
        [0.66, 0.89],
        [0.6, 0.86],
        [0.54, 0.89],
        [0.48, 0.86],
        [0.43, 0.89],
      ],
      "#f6b2a0",
      { w: 2.6 },
    );
    for (const x of [0.48, 0.54, 0.6, 0.66]) s.line(x, 0.1, x + 0.005, 0.86, { w: 1.4, alpha: 0.6 });
    // little window
    s.box(0.76, 0.14, 0.17, 0.2, "#bcd8f2", { w: 2.6 });
    s.line(0.845, 0.14, 0.845, 0.34, { w: 1.8 });
    baseboard(s, "#e6f3ee");
  },
  floor(s) {
    s.washAll("#f4fbf8");
    tiles(s, 12, 0.4);
    s.box(0.35, 0.3, 0.38, 0.24, "#f6b2a0", { w: 2.6 });
    for (let x = 0.38; x < 0.72; x += 0.03) s.line(x, 0.3, x, 0.27, { w: 1.2 });
    for (let x = 0.38; x < 0.72; x += 0.03) s.line(x, 0.54, x, 0.57, { w: 1.2 });
  },
  popups: [
    {
      size: 0.52,
      at: [0.26, 0.56],
      draw(s) {
        const tub: Pt[] = [
          [0.04, 0.42],
          [0.96, 0.42],
          [0.9, 0.78],
          [0.1, 0.78],
        ];
        s.shape(tub, "#ffffff", { mask: true, w: 3 });
        s.blob(0.5, 0.42, 0.46, 0.035, "#cfe8f7", { mask: true, w: 2 });
        for (const x of [0.16, 0.8]) s.blob(x + 0.03, 0.85, 0.04, 0.09, "#f0cf6e", { mask: true, w: 2.4 });
        s.stroke(
          [
            [0.86, 0.42],
            [0.86, 0.3],
            [0.78, 0.3],
          ],
          { w: 3, mask: true },
        );
        for (const [x, y, r] of [
          [0.3, 0.37, 0.05],
          [0.38, 0.33, 0.035],
          [0.6, 0.36, 0.045],
        ] as const)
          s.blob(x, y, r, r, "#ffffff", { mask: true, w: 1.6 });
      },
    },
    {
      size: 0.3,
      at: [0.72, 0.16],
      draw(s) {
        plant(s, 0.5, 1, 1.9, "#f6b2a0", true);
      },
    },
    {
      size: 0.24,
      at: [0.6, 0.66],
      draw(s) {
        s.shape(
          [
            [0.1, 0.35],
            [0.9, 0.35],
            [0.8, 1],
            [0.2, 1],
          ],
          "#e8c79a",
          { mask: true, w: 3 },
        );
        s.hatch(
          [
            [0.1, 0.35],
            [0.9, 0.35],
            [0.8, 1],
            [0.2, 1],
          ],
          0.06,
          -0.9,
          1.6,
          0.6,
        );
        s.blob(0.4, 0.33, 0.2, 0.08, "#ffffff", { mask: true, w: 2 });
      },
    },
  ],
};

const kitchen: Room = {
  name: "kitchen",
  mood: "nourishment, home, people over",
  left(s) {
    s.washAll("#f8e7a6");
    baseboard(s, "#f3dfb6");
    // window with herb pot
    s.box(0.12, 0.14, 0.3, 0.32, "#bcd8f2", { w: 3 });
    s.line(0.27, 0.14, 0.27, 0.46, { w: 2 });
    s.box(0.1, 0.46, 0.34, 0.03, "#ffffff", { w: 2.2 });
    plant(s, 0.2, 0.46, 0.5, "#e9a07c");
    // shelves with jars
    for (const y of [0.24, 0.44]) s.box(0.52, y, 0.4, 0.025, "#d6a46b", { w: 2.2 });
    const jar = (x: number, y: number, h: number, c: string) => {
      s.box(x, y - h, 0.07, h, c, { w: 2 });
      s.box(x - 0.005, y - h - 0.02, 0.08, 0.02, "#e9a07c", { w: 1.8 });
    };
    jar(0.55, 0.24, 0.1, "#fff3cf");
    jar(0.65, 0.24, 0.08, "#bcd4a8");
    jar(0.76, 0.24, 0.11, "#f8d5c0");
    s.blob(0.6, 0.41, 0.06, 0.03, "#ffffff", { w: 2 });
    s.blob(0.6, 0.39, 0.06, 0.03, "#ffffff", { w: 2 });
    s.box(0.72, 0.36, 0.06, 0.08, "#bcd8f2", { w: 2 });
    s.box(0.82, 0.34, 0.06, 0.1, "#e9a07c", { w: 2 });
    // hanging pans
    s.line(0.5, 0.56, 0.95, 0.56, { w: 2.6 });
    for (const [x, r] of [
      [0.6, 0.07],
      [0.78, 0.055],
    ] as const) {
      s.line(x, 0.56, x, 0.62, { w: 2 });
      s.blob(x, 0.62 + r, r, r, "#cfcfd8", { w: 2.4 });
    }
    // checker splashback strip
    for (let i = 0; i < 10; i++) if (i % 2) s.box(i * 0.1, 0.8, 0.1, 0.06, "#e9a07c", { w: 1.2, alpha: 0.6 });
  },
  right(s) {
    s.washAll("#f8e7a6");
    // upper cabinets
    s.box(0.04, 0.1, 0.56, 0.22, "#bcd4a8", { w: 2.6 });
    for (const x of [0.32]) s.line(x, 0.1, x, 0.32, { w: 2 });
    for (const x of [0.28, 0.36]) s.line(x, 0.24, x, 0.28, { w: 2.4 });
    // counter + lower cabinets
    s.box(0.02, 0.58, 0.64, 0.04, "#e8c79a", { w: 2.8 });
    s.box(0.04, 0.62, 0.6, 0.32, "#bcd4a8", { w: 2.6 });
    for (const x of [0.24, 0.44]) s.line(x, 0.62, x, 0.94, { w: 2 });
    for (const x of [0.2, 0.28, 0.4, 0.48]) s.line(x, 0.68, x, 0.72, { w: 2.4 });
    // stove + kettle
    s.box(0.08, 0.555, 0.2, 0.025, "#3b3b44", { w: 2 });
    s.shape(
      [
        [0.12, 0.555],
        [0.24, 0.555],
        [0.22, 0.47],
        [0.14, 0.47],
      ],
      "#e9a07c",
      { w: 2.6 },
    );
    s.stroke(s.ellipsePts(0.18, 0.47, 0.05, 0.04, Math.PI, Math.PI * 2, 12), { w: 2.2 });
    s.line(0.24, 0.5, 0.28, 0.47, { w: 2.2 });
    for (let i = 0; i < 3; i++)
      s.stroke(
        [
          [0.17 + i * 0.03, 0.42],
          [0.15 + i * 0.03, 0.38],
          [0.18 + i * 0.03, 0.34],
        ],
        { w: 1.4, alpha: 0.6 },
      );
    // cutting board + lemons
    s.box(0.36, 0.52, 0.16, 0.06, "#d6a46b", { w: 2 });
    s.blob(0.42, 0.51, 0.025, 0.02, "#f0cf6e", { w: 1.6 });
    s.blob(0.47, 0.51, 0.025, 0.02, "#f0cf6e", { w: 1.6 });
    // fridge
    s.box(0.7, 0.14, 0.26, 0.8, "#fffdf5", { w: 3 });
    s.line(0.7, 0.42, 0.96, 0.42, { w: 2.2 });
    s.line(0.73, 0.2, 0.73, 0.34, { w: 2.6 });
    s.line(0.73, 0.48, 0.73, 0.64, { w: 2.6 });
    s.box(0.8, 0.22, 0.1, 0.12, "#bcd8f2", { w: 1.8 });
    s.blob(0.84, 0.52, 0.02, 0.02, "#e9a07c", { w: 1.6 });
    s.blob(0.89, 0.58, 0.02, 0.02, "#bcd4a8", { w: 1.6 });
    baseboard(s, "#f3dfb6");
  },
  floor(s) {
    s.washAll("#fffaf0");
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) s.fill(s.rectPts(i / n, j / n, 1 / n, 1 / n), "#d9d5e6", { alpha: 0.75, jitter: 0.3 });
    tiles(s, n, 0.5);
  },
  popups: [
    {
      size: 0.5,
      at: [0.5, 0.5],
      draw(s) {
        // stools
        for (const x of [0.06, 0.78]) {
          s.blob(x + 0.08, 0.62, 0.1, 0.03, "#e9a07c", { mask: true, w: 2.4 });
          s.box(x + 0.03, 0.64, 0.025, 0.36, "#d6a46b", { mask: true, w: 2 });
          s.box(x + 0.11, 0.64, 0.025, 0.36, "#d6a46b", { mask: true, w: 2 });
        }
        // round table
        s.blob(0.5, 0.5, 0.3, 0.05, "#d6a46b", { mask: true, w: 3 });
        s.box(0.47, 0.54, 0.06, 0.38, "#d6a46b", { mask: true, w: 2.4 });
        s.blob(0.5, 0.95, 0.14, 0.03, "#d6a46b", { mask: true, w: 2.4 });
        // fruit bowl
        s.shape(s.ellipsePts(0.5, 0.42, 0.1, 0.06, 0, Math.PI, 12), "#bcd8f2", { mask: true, w: 2.2 });
        for (const [x, c] of [
          [0.44, "#e9a07c"],
          [0.5, "#f0cf6e"],
          [0.56, "#a9d39a"],
        ] as const)
          s.blob(x, 0.39, 0.03, 0.03, c, { mask: true, w: 1.8 });
      },
    },
  ],
};

const gym: Room = {
  name: "gym",
  mood: "body, discipline, anger worked out",
  left(s) {
    s.washAll("#f3d2c4");
    for (let row = 0; row < 18; row++) {
      const y = row * 0.055;
      s.line(0, y, 1, y, { w: 1, alpha: 0.25 });
      for (let x = (row % 2) * 0.06; x < 1; x += 0.12) s.line(x, y, x, y + 0.055, { w: 1, alpha: 0.25 });
    }
    baseboard(s, "#e4d2cc");
    // long mirror
    s.box(0.1, 0.1, 0.36, 0.8, "#e3eefa", { w: 3 });
    s.line(0.16, 0.3, 0.26, 0.18, { w: 1.4, alpha: 0.6 });
    s.line(0.18, 0.4, 0.34, 0.2, { w: 1.4, alpha: 0.6 });
    // poster
    s.box(0.56, 0.12, 0.3, 0.26, "#fffdf5", { w: 2.6 });
    s.text("one", 0.71, 0.2, 0.07);
    s.text("more", 0.71, 0.29, 0.08);
    s.line(0.6, 0.34, 0.82, 0.335, { w: 2 });
    // dumbbell rack
    s.box(0.52, 0.66, 0.4, 0.03, "#3b3b44", { w: 2.4 });
    s.box(0.54, 0.69, 0.03, 0.25, "#3b3b44", { w: 2 });
    s.box(0.87, 0.69, 0.03, 0.25, "#3b3b44", { w: 2 });
    s.box(0.52, 0.8, 0.4, 0.025, "#3b3b44", { w: 2 });
    for (const [x, r] of [
      [0.6, 0.03],
      [0.7, 0.035],
      [0.81, 0.04],
    ] as const) {
      s.line(x - 0.03, 0.62, x + 0.03, 0.62, { w: 3 });
      s.blob(x - 0.035, 0.62, 0.012, r, "#9db8ff", { w: 2 });
      s.blob(x + 0.035, 0.62, 0.012, r, "#9db8ff", { w: 2 });
    }
  },
  right(s) {
    s.washAll("#f3d2c4");
    for (let row = 0; row < 18; row++) {
      const y = row * 0.055;
      s.line(0, y, 1, y, { w: 1, alpha: 0.25 });
      for (let x = (row % 2) * 0.06; x < 1; x += 0.12) s.line(x, y, x, y + 0.055, { w: 1, alpha: 0.25 });
    }
    baseboard(s, "#e4d2cc");
    // window
    s.box(0.12, 0.14, 0.34, 0.34, "#bcd8f2", { w: 3 });
    s.line(0.29, 0.14, 0.29, 0.48, { w: 2 });
    s.line(0.12, 0.31, 0.46, 0.31, { w: 2 });
    // clock
    s.blob(0.7, 0.2, 0.08, 0.08, "#fffdf5", { w: 2.8 });
    s.line(0.7, 0.2, 0.7, 0.15, { w: 2.2 });
    s.line(0.7, 0.2, 0.74, 0.22, { w: 2.2 });
    // hook with skipping rope
    s.line(0.62, 0.42, 0.66, 0.42, { w: 3 });
    s.stroke(
      [
        [0.64, 0.42],
        [0.58, 0.6],
        [0.62, 0.74],
        [0.68, 0.6],
        [0.64, 0.42],
      ],
      { w: 2.2 },
    );
    s.box(0.57, 0.72, 0.03, 0.08, "#9db8ff", { w: 2 });
    s.box(0.67, 0.72, 0.03, 0.08, "#9db8ff", { w: 2 });
    // gloves
    s.line(0.82, 0.38, 0.86, 0.38, { w: 3 });
    for (const dx of [-0.04, 0.05]) {
      s.line(0.84, 0.38, 0.84 + dx, 0.46, { w: 1.6 });
      s.blob(0.84 + dx, 0.53, 0.045, 0.065, "#e86a5c", { w: 2.4 });
      s.box(0.81 + dx, 0.58, 0.06, 0.04, "#fffdf5", { w: 2 });
    }
  },
  floor(s) {
    s.washAll("#cfd0da");
    tiles(s, 4, 0.7);
    for (let i = 0; i < 160; i++) s.circle(s.r(), s.r(), 0.002, { w: 1, alpha: 0.3 });
    // yoga mat
    s.box(0.12, 0.08, 0.16, 0.6, "#9db8ff", { w: 2.6 });
    s.blob(0.2, 0.08, 0.08, 0.04, "#9db8ff", { w: 2.4 });
  },
  popups: [
    {
      size: 0.66,
      at: [0.48, 0.48],
      draw(s) {
        s.line(0.5, 0, 0.5, 0.14, { w: 2.6, mask: true });
        s.stroke(
          [
            [0.42, 0.18],
            [0.5, 0.13],
            [0.58, 0.18],
          ],
          { w: 2.2, mask: true },
        );
        const bag: Pt[] = [
          [0.38, 0.18],
          [0.62, 0.18],
          [0.64, 0.76],
          [0.5, 0.8],
          [0.36, 0.76],
        ];
        s.shape(bag, "#e86a5c", { mask: true, w: 3.2 });
        s.box(0.37, 0.3, 0.26, 0.05, "#3b3b44", { mask: true, w: 2 });
        s.box(0.37, 0.62, 0.26, 0.05, "#3b3b44", { mask: true, w: 2 });
        s.line(0.42, 0.38, 0.43, 0.58, { w: 1.4, alpha: 0.6 });
        // invisible stand so the card has something to stand on
        s.line(0.5, 0.8, 0.5, 0.98, { w: 2.4, mask: true });
        s.blob(0.5, 0.97, 0.16, 0.025, "#3b3b44", { w: 2, mask: true });
      },
    },
    {
      size: 0.2,
      at: [0.72, 0.22],
      draw(s) {
        s.stroke(s.ellipsePts(0.5, 0.42, 0.2, 0.24, Math.PI, Math.PI * 2, 14), { w: 6, mask: true });
        s.blob(0.5, 0.68, 0.36, 0.32, "#3b3b44", { mask: true, w: 3 });
      },
    },
    {
      size: 0.2,
      at: [0.22, 0.74],
      draw(s) {
        s.box(0.34, 0.25, 0.32, 0.75, "#9db8ff", { mask: true, w: 3 });
        s.box(0.4, 0.12, 0.2, 0.13, "#3b3b44", { mask: true, w: 2.6 });
        s.line(0.34, 0.5, 0.66, 0.5, { w: 1.6 });
      },
    },
  ],
};

const lounge: Room = {
  name: "lounge",
  mood: "play, games, doing nothing on purpose",
  left(s) {
    s.washAll("#c7e6e3");
    baseboard(s, "#e3efe9");
    // TV + console
    s.box(0.12, 0.26, 0.5, 0.3, "#3b3b44", { w: 3 });
    s.box(0.15, 0.29, 0.44, 0.24, "#9db8ff", { w: 2 });
    // tiny game on screen
    s.box(0.22, 0.44, 0.06, 0.06, "#f0cf6e", { w: 1.6 });
    s.box(0.4, 0.38, 0.12, 0.03, "#a9d39a", { w: 1.6 });
    s.circle(0.48, 0.34, 0.015, { w: 1.6 });
    s.box(0.08, 0.68, 0.6, 0.18, "#f7c9a8", { w: 2.8 });
    s.line(0.38, 0.68, 0.38, 0.86, { w: 2 });
    s.box(0.12, 0.71, 0.2, 0.05, "#fffdf5", { w: 2 });
    s.blob(0.5, 0.78, 0.05, 0.025, "#3b3b44", { w: 2 });
    s.blob(0.6, 0.79, 0.04, 0.02, "#e86a5c", { w: 2 });
    s.box(0.12, 0.86, 0.03, 0.08, "#d6a46b", { w: 1.8 });
    s.box(0.61, 0.86, 0.03, 0.08, "#d6a46b", { w: 1.8 });
    // games shelf
    s.box(0.72, 0.4, 0.22, 0.025, "#d6a46b", { w: 2.2 });
    const cols = ["#e86a5c", "#9db8ff", "#f0cf6e", "#a9d39a"];
    cols.forEach((c, i) => s.box(0.74 + i * 0.045, 0.31, 0.04, 0.09, c, { w: 1.8 }));
    s.box(0.72, 0.58, 0.22, 0.025, "#d6a46b", { w: 2.2 });
    s.blob(0.8, 0.54, 0.05, 0.04, "#f7c9a8", { w: 2 });
    s.text("?", 0.8, 0.54, 0.05);
  },
  right(s) {
    s.washAll("#c7e6e3");
    baseboard(s, "#e3efe9");
    fairyLights(s, 0.02, 0.98, 0.07, 0.05);
    // posters
    frame(s, 0.1, 0.2, 0.22, 0.3, "#f7c9a8", (k) => {
      k.circle(0.21, 0.31, 0.04);
      k.line(0.15, 0.44, 0.27, 0.4);
    });
    frame(s, 0.36, 0.24, 0.18, 0.18, "#f0cf6e", (k) => {
      k.stroke(
        [
          [0.39, 0.38],
          [0.43, 0.3],
          [0.47, 0.36],
          [0.51, 0.28],
        ],
        { w: 1.8 },
      );
    });
    // bookshelf
    s.box(0.62, 0.22, 0.32, 0.72, "#d6a46b", { w: 3 });
    for (const y of [0.4, 0.58, 0.76]) s.line(0.62, y, 0.94, y, { w: 2.2 });
    const cols = ["#e86a5c", "#9db8ff", "#f0cf6e", "#a9d39a", "#f7c9a8", "#fffdf5"];
    for (const [y, n] of [
      [0.4, 5],
      [0.58, 4],
      [0.76, 6],
    ] as const)
      for (let i = 0; i < n; i++) s.box(0.65 + i * 0.045, y - 0.12, 0.04, 0.12, cols[(i + n) % cols.length], { w: 1.6 });
    // clock
    s.blob(0.24, 0.66, 0.06, 0.06, "#fffdf5", { w: 2.6 });
    s.line(0.24, 0.66, 0.24, 0.62, { w: 2 });
    s.line(0.24, 0.66, 0.27, 0.68, { w: 2 });
  },
  floor(s) {
    planks(s, "#e8c79a", 7);
    s.blob(0.55, 0.5, 0.36, 0.3, "#f7e2a2", { w: 2.6 });
    for (let i = 0; i < 70; i++) {
      const a = s.r() * Math.PI * 2;
      const rr = Math.sqrt(s.r()) * 0.3;
      const x = 0.55 + Math.cos(a) * rr * 1.1;
      const y = 0.5 + Math.sin(a) * rr * 0.9;
      s.line(x, y, x + 0.008, y - 0.02, { w: 1.2, alpha: 0.55 });
    }
    s.blob(0.75, 0.2, 0.06, 0.04, "#e86a5c", { w: 2.2 });
    for (const [x, y] of [
      [0.73, 0.19],
      [0.77, 0.21],
      [0.75, 0.18],
    ])
      s.circle(x, y, 0.01, { w: 1.4 });
  },
  popups: [
    {
      size: 0.6,
      at: [0.44, 0.5],
      draw(s) {
        s.box(0.08, 0.4, 0.84, 0.3, "#f7c9a8", { mask: true, w: 3 });
        s.box(0.02, 0.5, 0.12, 0.38, "#f7c9a8", { mask: true, w: 3 });
        s.box(0.86, 0.5, 0.12, 0.38, "#f7c9a8", { mask: true, w: 3 });
        s.box(0.14, 0.66, 0.72, 0.18, "#f7c9a8", { mask: true, w: 3 });
        s.line(0.5, 0.66, 0.5, 0.84, { w: 2 });
        s.blob(0.28, 0.6, 0.1, 0.08, "#9db8ff", { mask: true, w: 2.4 });
        s.blob(0.7, 0.6, 0.09, 0.08, "#f0cf6e", { mask: true, w: 2.4 });
        s.box(0.1, 0.88, 0.04, 0.1, "#d6a46b", { mask: true, w: 2 });
        s.box(0.86, 0.88, 0.04, 0.1, "#d6a46b", { mask: true, w: 2 });
      },
    },
    {
      size: 0.28,
      at: [0.72, 0.14],
      draw(s) {
        s.shape(
          [
            [0.2, 1],
            [0.12, 0.7],
            [0.28, 0.42],
            [0.55, 0.36],
            [0.8, 0.5],
            [0.9, 0.78],
            [0.82, 1],
          ],
          "#e86a5c",
          { mask: true, w: 3 },
        );
        s.stroke(
          [
            [0.3, 0.6],
            [0.5, 0.7],
            [0.75, 0.62],
          ],
          { w: 1.8 },
        );
      },
    },
  ],
};

const balcony: Room = {
  name: "balcony",
  mood: "evenings, the big picture, gratitude",
  left(s) {
    s.washAll("#b9c6f2");
    s.fill(s.rectPts(-0.02, 0.3, 1.04, 0.72), "#e4c8ee", { alpha: 0.7, jitter: 0 });
    // moon + stars
    s.shape(s.ellipsePts(0.3, 0.2, 0.08, 0.08, 0.7, 5.6, 22), "#fff2b0", { w: 2.4 });
    for (let i = 0; i < 14; i++) s.text("*", 0.05 + s.r() * 0.9, 0.06 + s.r() * 0.36, 0.035 + s.r() * 0.02);
    // railing
    s.box(-0.02, 0.52, 1.04, 0.035, "#d6a46b", { w: 2.8 });
    for (let x = 0.04; x < 1; x += 0.08) s.box(x, 0.555, 0.022, 0.38, "#fffdf5", { w: 1.8 });
    baseboard(s, "#d6a46b");
    // hanging planters on the rail
    for (const x of [0.2, 0.62]) {
      s.box(x - 0.08, 0.46, 0.16, 0.08, "#e9a07c", { w: 2.4 });
      for (let i = 0; i < 4; i++)
        s.stroke(
          [
            [x - 0.06 + i * 0.04, 0.46],
            [x - 0.08 + i * 0.05, 0.38],
            [x - 0.05 + i * 0.04, 0.33],
          ],
          { w: 1.8 },
        );
      for (let i = 0; i < 3; i++)
        s.stroke(
          [
            [x - 0.06 + i * 0.06, 0.54],
            [x - 0.07 + i * 0.06, 0.62],
            [x - 0.05 + i * 0.06, 0.68],
          ],
          { w: 1.6 },
        );
      for (let i = 0; i < 3; i++) s.blob(x - 0.06 + i * 0.06, 0.4 - (i % 2) * 0.04, 0.025, 0.018, "#a9d39a", { w: 1.6 });
    }
  },
  right(s) {
    s.washAll("#b9c6f2");
    s.fill(s.rectPts(-0.02, 0.3, 1.04, 0.72), "#e4c8ee", { alpha: 0.7, jitter: 0 });
    fairyLights(s, 0.0, 1.0, 0.06, 0.07);
    // skyline
    const bld: [number, number, number][] = [
      [0.02, 0.3, 0.12],
      [0.15, 0.22, 0.1],
      [0.26, 0.36, 0.14],
      [0.42, 0.18, 0.09],
      [0.52, 0.28, 0.16],
      [0.7, 0.34, 0.1],
      [0.81, 0.24, 0.14],
    ];
    for (const [x, top, w] of bld) {
      s.box(x, top, w, 0.56 - top, "#8f8fc4", { w: 2.2 });
      for (let wy = top + 0.04; wy < 0.5; wy += 0.06)
        for (let wx = x + 0.02; wx < x + w - 0.03; wx += 0.04) if (s.r() > 0.45) s.box(wx, wy, 0.018, 0.025, "#ffe08a", { w: 1 });
    }
    s.box(-0.02, 0.52, 1.04, 0.035, "#d6a46b", { w: 2.8 });
    for (let x = 0.04; x < 1; x += 0.08) s.box(x, 0.555, 0.022, 0.38, "#fffdf5", { w: 1.8 });
    baseboard(s, "#d6a46b");
  },
  floor(s) {
    planks(s, "#e2b98a", 9, false);
  },
  popups: [
    {
      size: 0.32,
      at: [0.26, 0.6],
      draw(s) {
        s.box(0.24, 0.2, 0.5, 0.36, "#9db8ff", { mask: true, w: 2.8 });
        s.box(0.2, 0.56, 0.6, 0.08, "#9db8ff", { mask: true, w: 2.8 });
        s.line(0.26, 0.64, 0.74, 1, { w: 3.4, mask: true });
        s.line(0.74, 0.64, 0.26, 1, { w: 3.4, mask: true });
      },
    },
    {
      size: 0.3,
      at: [0.6, 0.24],
      draw(s) {
        s.box(0.24, 0.2, 0.5, 0.36, "#f7c9a8", { mask: true, w: 2.8 });
        s.box(0.2, 0.56, 0.6, 0.08, "#f7c9a8", { mask: true, w: 2.8 });
        s.line(0.26, 0.64, 0.74, 1, { w: 3.4, mask: true });
        s.line(0.74, 0.64, 0.26, 1, { w: 3.4, mask: true });
      },
    },
    {
      size: 0.36,
      at: [0.52, 0.5],
      draw(s) {
        s.blob(0.5, 0.5, 0.36, 0.06, "#d6a46b", { mask: true, w: 3 });
        s.box(0.47, 0.55, 0.06, 0.45, "#d6a46b", { mask: true, w: 2.4 });
        // chai
        s.box(0.38, 0.32, 0.12, 0.14, "#fffdf5", { mask: true, w: 2.4 });
        s.stroke(s.ellipsePts(0.51, 0.39, 0.03, 0.04, -1.4, 1.4, 10), { w: 2.2 });
        s.fill(s.rectPts(0.39, 0.34, 0.1, 0.03), "#c68d5c");
        for (let i = 0; i < 2; i++)
          s.stroke(
            [
              [0.42 + i * 0.04, 0.29],
              [0.4 + i * 0.04, 0.22],
              [0.43 + i * 0.04, 0.15],
            ],
            { w: 1.6, alpha: 0.7, mask: true },
          );
      },
    },
    {
      size: 0.5,
      at: [0.24, 0.8],
      draw(s) {
        plant(s, 0.5, 1, 2.3, "#e9a07c", true);
      },
    },
  ],
};

export const ROOMS: Room[] = [bedroom, bathroom, kitchen, gym, lounge, balcony];

// ---------------------------------------------------------------------------

export function drawFrontCover(s: Sketch) {
  // a hand-drawn double border
  s.rect(0.06, 0.06, 0.88, 0.88, { w: 3 });
  s.rect(0.09, 0.09, 0.82, 0.82, { w: 1.5, alpha: 0.75 });
  for (const [x, y] of [
    [0.09, 0.09],
    [0.91, 0.09],
    [0.09, 0.91],
    [0.91, 0.91],
  ])
    s.circle(x, y, 0.012, { w: 1.6 });
  s.text("dakshie's", 0.5, 0.4, 0.13);
  s.text("journal", 0.5, 0.54, 0.13);
  // a small heart, drawn in one go with the pen overlapping at the bottom
  const heart: Pt[] = [];
  for (let i = 0; i <= 44; i++) {
    const t = (i / 44) * Math.PI * 2.06;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    heart.push([0.5 + x * 0.0036, 0.705 - y * 0.0036]);
  }
  s.stroke(heart, { w: 3, overshoot: 0 });
}

export function drawBackCover(s: Sketch) {
  s.rect(0.06, 0.06, 0.88, 0.88, { w: 3 });
  s.rect(0.09, 0.09, 0.82, 0.82, { w: 1.5, alpha: 0.75 });
}
