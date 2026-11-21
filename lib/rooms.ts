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

export type PopUp = { size: number; at: [number, number]; draw: (s: Sketch) => void };
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

const bedroom: Room = {
  name: "bedroom",
  mood: "slow mornings, late-night thinking",
  left(s) {
    s.washAll("#ddd2f2");
    // wallpaper dots
    for (let i = 0; i < 40; i++) s.circle(s.r(), s.r() * 0.85, 0.004, { w: 1.2, alpha: 0.35 });
    baseboard(s);
    // window with curtains
    s.box(0.16, 0.2, 0.42, 0.44, "#bcd8f2", { w: 3 });
    s.line(0.37, 0.2, 0.37, 0.64, { w: 2.2 });
    s.line(0.16, 0.42, 0.58, 0.42, { w: 2.2 });
    s.circle(0.48, 0.3, 0.035, { w: 1.6 });
    s.line(0.1, 0.16, 0.64, 0.16, { w: 3 });
    for (const [x0, dir] of [
      [0.1, 1],
      [0.64, -1],
    ] as const) {
      const pts: Pt[] = [
        [x0, 0.16],
        [x0 + 0.12 * dir, 0.16],
        [x0 + 0.06 * dir, 0.42],
        [x0 + 0.1 * dir, 0.7],
        [x0, 0.7],
      ];
      s.shape(pts, "#f2b6c1", { w: 2.4 });
      s.line(x0 + 0.04 * dir, 0.18, x0 + 0.03 * dir, 0.68, { w: 1.3, alpha: 0.6 });
    }
    fairyLights(s, 0.05, 0.95, 0.06);
    // moon sticker near the corner
    s.shape(s.ellipsePts(0.84, 0.34, 0.06, 0.06, 0.6, 5.7, 20), "#fff2b0", { w: 2 });
    for (const [x, y] of [
      [0.77, 0.5],
      [0.9, 0.55],
      [0.82, 0.62],
    ])
      s.text("*", x, y, 0.05);
  },
  right(s) {
    s.washAll("#ddd2f2");
    for (let i = 0; i < 40; i++) s.circle(s.r(), s.r() * 0.85, 0.004, { w: 1.2, alpha: 0.35 });
    baseboard(s);
    // shelf with books + plant
    s.box(0.1, 0.3, 0.5, 0.025, "#d6a46b", { w: 2.2 });
    const books = ["#f2b6c1", "#bcd8f2", "#f0cf6e", "#a9d39a", "#f2b6c1"];
    let bx = 0.14;
    books.forEach((c, i) => {
      const w = 0.035 + (i % 2) * 0.01;
      const h = 0.11 + ((i * 37) % 5) * 0.012;
      s.box(bx, 0.3 - h, w, h, c, { w: 1.8 });
      bx += w + 0.006;
    });
    plant(s, 0.5, 0.3, 0.5);
    // cork board with notes
    s.box(0.66, 0.12, 0.26, 0.26, "#e8c79a", { w: 2.6 });
    s.box(0.69, 0.15, 0.09, 0.08, "#fff6a8", { w: 1.6 });
    s.box(0.8, 0.17, 0.09, 0.09, "#bcd8f2", { w: 1.6 });
    s.box(0.71, 0.26, 0.1, 0.09, "#f2b6c1", { w: 1.6 });
    for (const y of [0.18, 0.2]) s.line(0.7, y, 0.76, y, { w: 1, alpha: 0.7 });
    // desk
    s.box(0.08, 0.6, 0.62, 0.04, "#d6a46b", { w: 2.8 });
    s.box(0.1, 0.64, 0.035, 0.3, "#d6a46b", { w: 2.2 });
    s.box(0.645, 0.64, 0.035, 0.3, "#d6a46b", { w: 2.2 });
    s.box(0.42, 0.64, 0.24, 0.14, "#e8c79a", { w: 2 });
    s.line(0.48, 0.71, 0.6, 0.71, { w: 2 });
    // lamp
    s.line(0.2, 0.6, 0.2, 0.45, { w: 2.4 });
    s.line(0.2, 0.45, 0.27, 0.4, { w: 2.4 });
    s.shape(
      [
        [0.22, 0.36],
        [0.34, 0.39],
        [0.3, 0.47],
        [0.2, 0.42],
      ],
      "#f0cf6e",
      { w: 2.2 },
    );
    s.shape(s.ellipsePts(0.2, 0.6, 0.05, 0.012), "#d6a46b", { w: 2 });
    // open notebook + mug
    s.shape(
      [
        [0.32, 0.6],
        [0.42, 0.57],
        [0.52, 0.6],
      ],
      "#fffdf5",
      { w: 2 },
    );
    s.line(0.42, 0.57, 0.42, 0.6, { w: 1.4 });
    s.box(0.56, 0.53, 0.06, 0.07, "#f2b6c1", { w: 2 });
    s.stroke(s.ellipsePts(0.625, 0.565, 0.018, 0.022, -1.4, 1.4, 10), { w: 2 });
  },
  floor(s) {
    planks(s, "#e8c79a", 8);
    s.blob(0.55, 0.45, 0.28, 0.28, "#f2b6c1", { w: 2.6 });
    s.ellipse(0.55, 0.45, 0.22, 0.22, { w: 1.4, alpha: 0.7 });
    for (const dx of [0, 0.07]) s.blob(0.78 + dx, 0.82, 0.025, 0.05, "#fffdf5", { w: 2 });
  },
  popups: [
    {
      size: 0.56,
      at: [0.24, 0.52],
      draw(s) {
        // headboard
        s.shape(
          [
            [0.06, 1],
            [0.06, 0.38],
            [0.5, 0.3],
            [0.94, 0.38],
            [0.94, 1],
          ],
          "#d6a46b",
          { mask: true, w: 3 },
        );
        // mattress + quilt
        s.box(0.04, 0.6, 0.92, 0.32, "#fffdf5", { mask: true, w: 2.8 });
        s.shape(
          [
            [0.04, 0.68],
            [0.96, 0.68],
            [0.96, 0.92],
            [0.04, 0.92],
          ],
          "#b9a6ea",
          { mask: true, w: 2.6 },
        );
        for (let x = 0.12; x < 0.96; x += 0.12) s.line(x, 0.68, x, 0.92, { w: 1.2, alpha: 0.6 });
        for (const x of [0.12, 0.54]) s.blob(x + 0.17, 0.6, 0.16, 0.07, "#fffdf5", { mask: true, w: 2.4 });
        s.box(0.08, 0.92, 0.05, 0.08, "#d6a46b", { mask: true });
        s.box(0.87, 0.92, 0.05, 0.08, "#d6a46b", { mask: true });
      },
    },
    {
      size: 0.32,
      at: [0.5, 0.16],
      draw(s) {
        s.box(0.22, 0.18, 0.56, 0.36, "#f2b6c1", { mask: true, w: 3 });
        s.box(0.16, 0.54, 0.68, 0.12, "#f2b6c1", { mask: true, w: 3 });
        s.box(0.2, 0.66, 0.08, 0.34, "#d6a46b", { mask: true, w: 2.6 });
        s.box(0.72, 0.66, 0.08, 0.34, "#d6a46b", { mask: true, w: 2.6 });
      },
    },
  ],
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
  s.washAll("#dde2f6", 0.9);
  s.rect(0.05, 0.05, 0.9, 0.9, { w: 2.6 });
  s.rect(0.08, 0.08, 0.84, 0.84, { w: 1.4, alpha: 0.7 });
  // scribbled circle with a little house, like the avatars in a sketched feed
  const circ = s.ellipsePts(0.5, 0.38, 0.2, 0.2);
  s.fill(circ, "#fffdf5", { alpha: 1, jitter: 0 });
  s.scribble(circ, 0.014, 1.6);
  s.ellipse(0.5, 0.38, 0.2, 0.2, { w: 2.8 });
  const house: Pt[] = [
    [0.37, 0.42],
    [0.5, 0.27],
    [0.63, 0.42],
    [0.6, 0.42],
    [0.6, 0.54],
    [0.4, 0.54],
    [0.4, 0.42],
  ];
  s.fill(house, "#fffdf5", { alpha: 1, jitter: 0 });
  s.stroke(house, { w: 2.8, closed: true });
  s.rect(0.47, 0.46, 0.06, 0.08, { w: 2.2 });
  s.text("unfold", 0.5, 0.71, 0.13);
  s.stroke(
    [
      [0.3, 0.78],
      [0.5, 0.79],
      [0.7, 0.775],
    ],
    { w: 2 },
  );
  s.text("a journal house", 0.5, 0.85, 0.055, { weight: 500 });
}

export function drawBackCover(s: Sketch) {
  s.washAll("#dde2f6", 0.9);
  s.rect(0.05, 0.05, 0.9, 0.9, { w: 2.6 });
  s.text("six rooms, one me", 0.5, 0.5, 0.06, { weight: 500 });
}
