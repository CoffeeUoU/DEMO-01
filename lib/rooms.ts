// Clean, luminous matte pastel sky backdrops for the full-3D four-seasons dioramas.
// All foreground trees, hills, critters, AND wall clouds/mountains/rainbows/balloons/stars
// are rendered as unified 3D Low-Poly models in SeasonTree3D.tsx & SeasonWall3D.tsx!

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

function drawSkyBand(s: Sketch, y: number, col: string, alpha = 0.5) {
  const band: Pt[] = [
    [0, 1],
    [0, y],
    [0.5, y - 0.02],
    [1, y],
    [1, 1],
  ];
  s.fill(band, tint(col), { alpha, jitter: 0.15 });
}

const spring: Room = {
  name: "spring",
  mood: "first blossoms, warm morning breeze",
  left(s) {
    s.washAll(tint("#eaf5ff"), 1);
    drawSkyBand(s, 0.56, "#fff2f7", 0.55);
  },
  right(s) {
    s.washAll(tint("#ecf6ff"), 1);
    drawSkyBand(s, 0.56, "#fff2f7", 0.55);
    drawSignpost(s, 0.76, 0.62, "spring", "#ebd1ae", "#fffbf2");
  },
  floor(s) {
    s.washAll(tint("#dff2cf"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.23, 0.18), 0.13, 22);
  },
  popups: [],
};

const summer: Room = {
  name: "summer",
  mood: "bright skies, deep green shade",
  left(s) {
    s.washAll(tint("#d2ecfd"), 1);
    drawSkyBand(s, 0.56, "#ebf9ff", 0.55);
  },
  right(s) {
    s.washAll(tint("#d2ecfd"), 1);
    drawSkyBand(s, 0.56, "#ebf9ff", 0.55);
    drawSignpost(s, 0.76, 0.62, "summer", "#e0be96", "#fffef5");
  },
  floor(s) {
    s.washAll(tint("#c8e8b6"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.27, 0.22), 0.18, 24);
  },
  popups: [],
};

const autumn: Room = {
  name: "autumn",
  mood: "amber dusk, drifting maple leaves",
  left(s) {
    s.washAll(tint("#ffeedb"), 1);
    drawSkyBand(s, 0.46, "#ffd8b4", 0.45);
    drawSkyBand(s, 0.62, "#ffc594", 0.42);
  },
  right(s) {
    s.washAll(tint("#ffecd8"), 1);
    drawSkyBand(s, 0.46, "#ffd8b4", 0.45);
    drawSkyBand(s, 0.62, "#ffc594", 0.42);
    drawSignpost(s, 0.76, 0.62, "autumn", "#deb28a", "#fff7ea");
  },
  floor(s) {
    s.washAll(tint("#f8e4be"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.23, 0.18), 0.14, 22);
  },
  popups: [],
};

const winter: Room = {
  name: "winter",
  mood: "moonlit winter night, quiet snowfall & warm lantern glow",
  left(s) {
    s.washAll(tint("#5876bc"), 1);
    drawSkyBand(s, 0.58, "#8aa8e2", 0.48);
  },
  right(s) {
    s.washAll(tint("#5876bc"), 1);
    drawSkyBand(s, 0.58, "#8aa8e2", 0.48);
    drawSignpost(s, 0.76, 0.62, "winter", "#7b95c4", "#f4f8ff");
  },
  floor(s) {
    s.washAll(tint("#e4effc"), 1);
    s.shadow(s.ellipsePts(...F(0.48, 0.48), 0.22, 0.17), 0.16, 22);
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
