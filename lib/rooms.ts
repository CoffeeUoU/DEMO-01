// Clean, luminous watercolor sky & ground backdrops for the full-3D four-seasons dioramas.
// All foreground trees, hills, cottages, ponds, windmills, snowmen, clouds, and sun/moon
// are rendered as unified 3D models in components/SeasonTree3D.tsx.

import type { Pt, Sketch } from "./sketch";
import { tint } from "./style";

type PopUp = { size: number; at: [number, number]; draw: (s: Sketch) => void; halo?: number };
export type Room = {
  name: string;
  mood: string;
  left: (s: Sketch) => void;
  right: (s: Sketch) => void;
  floor: (s: Sketch) => void;
  popups: PopUp[];
};

const F = (a: number, b: number): Pt => [a, 1 - b];

function drawSignpost(s: Sketch, x: number, y: number, label: string, woodCol: string, paperCol: string) {
  s.box(x - 0.014, y + 0.14, 0.028, 0.24, tint(woodCol), { w: 2.0 });
  const board = s.rectPts(x - 0.135, y - 0.02, 0.27, 0.17);
  s.sticker(board, 6, 0.18, tint(woodCol));
  s.stroke(board, { closed: true, w: 2.3 });
  const note = s.rectPts(x - 0.11, y + 0.005, 0.22, 0.12);
  s.fill(note, tint(paperCol), { alpha: 0.96, jitter: 0.2 });
  s.stroke(note, { closed: true, w: 1.5 });
  s.text(label, x, y + 0.068, 0.05, { weight: 700 });
  s.mark("journal", board, 0.03);
}

function drawHorizonMist(s: Sketch, y: number, col: string) {
  const band: Pt[] = [
    [0, 1],
    [0, y],
    [0.35, y - 0.03],
    [0.72, y + 0.02],
    [1, y - 0.01],
    [1, 1],
  ];
  s.fill(band, tint(col), { alpha: 0.55, jitter: 0.3 });
}

function drawBird(s: Sketch, x: number, y: number, r: number) {
  s.stroke(
    [
      [x - r, y + r * 0.22],
      [x - r * 0.45, y - r * 0.22],
      [x, y + r * 0.08],
      [x + r * 0.45, y - r * 0.22],
      [x + r, y + r * 0.22],
    ],
    { w: 1.5, overshoot: 0, alpha: 0.72 },
  );
}

/* ============================================================================
   1. SPRING — Bright pastel sky & sunlit meadow
   ============================================================================ */
const spring: Room = {
  name: "spring",
  mood: "first blossoms, warm morning breeze",
  left(s) {
    s.washAll(tint("#eef7fe"), 1);
    drawHorizonMist(s, 0.72, "#e0f2d9");
    drawBird(s, 0.30, 0.26, 0.028);
    drawBird(s, 0.38, 0.22, 0.020);
  },
  right(s) {
    s.washAll(tint("#f1f8ff"), 1);
    drawHorizonMist(s, 0.72, "#e0f2d9");
    drawSignpost(s, 0.72, 0.62, "spring", "#ebd1ae", "#fffbf2");
  },
  floor(s) {
    s.washAll(tint("#dff2cf"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.23, 0.18), 0.13, 22);
  },
  popups: [],
};

/* ============================================================================
   2. SUMMER — Clear azure sky & vibrant green lawn
   ============================================================================ */
const summer: Room = {
  name: "summer",
  mood: "bright skies, deep green shade",
  left(s) {
    s.washAll(tint("#dff1fd"), 1);
    drawHorizonMist(s, 0.72, "#c8eac0");
    drawBird(s, 0.26, 0.24, 0.026);
    drawBird(s, 0.34, 0.20, 0.018);
  },
  right(s) {
    s.washAll(tint("#dff1fd"), 1);
    drawHorizonMist(s, 0.72, "#c8eac0");
    drawSignpost(s, 0.72, 0.62, "summer", "#e0be96", "#fffef5");
  },
  floor(s) {
    s.washAll(tint("#c8e8b6"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.27, 0.22), 0.18, 24);
  },
  popups: [],
};

/* ============================================================================
   3. AUTUMN — Warm golden peach dusk & honey-gold lawn
   ============================================================================ */
const autumn: Room = {
  name: "autumn",
  mood: "amber dusk, drifting maple leaves",
  left(s) {
    s.washAll(tint("#fff0df"), 1);
    drawHorizonMist(s, 0.72, "#f9d7b4");
    for (const [bx, by, br] of [
      [0.24, 0.28, 0.024],
      [0.30, 0.25, 0.020],
      [0.36, 0.28, 0.018],
    ] as const) {
      drawBird(s, bx, by, br);
    }
  },
  right(s) {
    s.washAll(tint("#ffedda"), 1);
    drawHorizonMist(s, 0.72, "#f9d7b4");
    drawSignpost(s, 0.72, 0.62, "autumn", "#deb28a", "#fff7ea");
  },
  floor(s) {
    s.washAll(tint("#f8e4be"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.23, 0.18), 0.14, 22);
  },
  popups: [],
};

/* ============================================================================
   4. WINTER — Luminous ice-blue twilight & crisp bright snow
   ============================================================================ */
const winter: Room = {
  name: "winter",
  mood: "quiet snowfall, warm lantern glow",
  left(s) {
    s.washAll(tint("#d8e8f8"), 1);
    drawHorizonMist(s, 0.72, "#e8f2fc");
    s.star(0.24, 0.20, 0.015, { alpha: 0.7 });
    s.star(0.44, 0.16, 0.012, { alpha: 0.65 });
  },
  right(s) {
    s.washAll(tint("#d8e8f8"), 1);
    drawHorizonMist(s, 0.72, "#e8f2fc");
    s.star(0.76, 0.18, 0.015, { alpha: 0.7 });
    drawSignpost(s, 0.72, 0.62, "winter", "#b6c7dc", "#f8fbff");
  },
  floor(s) {
    s.washAll(tint("#f2f7fd"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.22, 0.17), 0.12, 22);
  },
  popups: [],
};

export const ROOMS: Room[] = [spring, summer, autumn, winter];

// ---------------------------------------------------------------------------

export function drawFrontCover(s: Sketch) {
  s.washAll(tint("#f9f4eb"), 1);
  s.rect(0.07, 0.07, 0.86, 0.86, { w: 3 });
  s.rect(0.095, 0.095, 0.81, 0.81, { w: 1.3, alpha: 0.6 });
  s.text("four seasons", 0.5, 0.28, 0.115);
  s.text("one tree, unfolding", 0.5, 0.38, 0.048, { weight: 500 });

  s.stroke(
    [
      [0.46, 0.82],
      [0.48, 0.65],
      [0.42, 0.56],
    ],
    { w: 2.8 },
  );
  s.stroke(
    [
      [0.54, 0.82],
      [0.52, 0.65],
      [0.58, 0.56],
    ],
    { w: 2.8 },
  );
  s.line(0.32, 0.82, 0.68, 0.82, { w: 2.0 });
  s.blob(0.42, 0.53, 0.085, 0.075, tint("#ffd6e5"), { w: 2.0 });
  s.blob(0.58, 0.53, 0.085, 0.075, tint("#ffc87c"), { w: 2.0 });
  s.blob(0.50, 0.46, 0.095, 0.080, tint("#c8ebba"), { w: 2.0 });
}

export function drawBackCover(s: Sketch) {
  s.washAll(tint("#f9f4eb"), 1);
  s.rect(0.07, 0.07, 0.86, 0.86, { w: 3 });
}
