"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Season } from "./SeasonTree3D";
import { book } from "@/lib/store";

function makeRng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth edge fade to 0 at diamond border (|x| + |z - 0.028| = 0.688) so outer edges sit 100% flush on paper
function edgeEnvelope(x: number, z: number): number {
  const d = Math.max(0, 0.688 - (Math.abs(x) + Math.abs(z - 0.028)));
  const u = Math.min(1, d / 0.16);
  return u * u * (3 - 2 * u);
}

// Exact continuous 3D terrain elevation per season (identical along x = 0 so posX & negX halves meet seamlessly!)
export function getTerrainY(season: Season, x: number, z: number): number {
  const env = edgeEnvelope(x, z);
  if (env <= 0.001) return 0.001;

  // Keep central tree trunk base gently level around (0, 0)
  const rCenter = Math.hypot(x, z);
  const centerFlat = Math.min(1, Math.max(0, (rCenter - 0.08) / 0.14));

  if (season === "spring") {
    // Soft terraced sakura hillside rising gently toward the back & left picnic meadow
    const backSlope = Math.max(0, -z + 0.18) * 0.062;
    const ripple = (Math.sin(x * 5.2) * Math.cos(z * 4.6) * 0.5 + 0.5) * 0.016;
    const terrace = Math.floor((backSlope + ripple) * 34) / 34 * 0.35 + (backSlope + ripple) * 0.65;
    return 0.002 + env * (0.006 + terrace * (0.35 + 0.65 * centerFlat));
  }

  if (season === "summer") {
    // Lush rolling meadow with a sunken crystal brook curving toward the right-front lotus pond [0.24, 0.18]
    const brookZ = 0.28 - (x + 0.10) * 0.32;
    const distBrook = Math.abs(z - brookZ);
    const inBrook = x > -0.34 && x < 0.30 ? Math.max(0, 1 - distBrook / 0.072) : 0;
    const inPond = Math.max(0, 1 - Math.hypot(x - 0.24, z - 0.18) / 0.22);
    const waterCut = Math.max(inBrook * inBrook, inPond);

    const hills = (Math.max(0, -z + 0.12) * 0.048 + (Math.sin(x * 4.8 + 0.6) * 0.5 + 0.5) * 0.018) * centerFlat;
    const raw = (0.016 + hills) * (1 - waterCut * 0.92);
    return 0.002 + env * Math.max(0.001, raw);
  }

  if (season === "autumn") {
    // Rolling golden harvest hills with a cozy knoll under the right cottage [0.31, -0.09]
    const cottageKnoll = Math.exp(-((x - 0.30) ** 2 + (z + 0.09) ** 2) / 0.045) * 0.032;
    const scarecrowKnoll = Math.exp(-((x + 0.30) ** 2 + (z + 0.10) ** 2) / 0.05) * 0.028;
    const wave = (Math.sin(x * 5.0 - 0.4) * Math.cos(z * 4.4) * 0.5 + 0.5) * 0.022;
    const backRise = Math.max(0, -z + 0.05) * 0.036;
    return 0.002 + env * (0.006 + (cottageKnoll + scarecrowKnoll + wave + backRise) * (0.35 + 0.65 * centerFlat));
  }

  // WINTER: Sheltering moonlit snow valley cradling the front-right mirror frozen pond
  const inLake = Math.max(0, 1 - Math.hypot(x - 0.24, z - 0.18) / 0.19);
  const backRim = Math.max(0, -z + 0.08) * 0.052;
  const sideBanks = Math.max(0, Math.abs(x) - 0.14) * 0.045;
  const drift = (Math.sin(x * 5.4 + 1.1) * Math.sin(z * 5.0) * 0.5 + 0.5) * 0.015;
  const raw = (0.008 + (backRim + sideBanks + drift) * (0.35 + 0.65 * centerFlat)) * (1 - inLake * 0.88);
  return 0.002 + env * Math.max(0.001, raw);
}

// Subdivided low-poly sculpted half-diamond terrain with soft vertex-color height shading!
function createSculptedHalfTerrainGeo(season: Season, posX: boolean): THREE.BufferGeometry {
  const segs = 14;
  // Triangle corners: A = back spine (0, -0.662), B = front tip (0, 0.718), C = outer wing (±0.690, 0.028)
  const ax = 0, az = -0.662;
  const bx = 0, bz = 0.718;
  const cx = posX ? 0.690 : -0.690, cz = 0.028;

  const lowCol = new THREE.Color(
    season === "spring" ? "#8fd472" : season === "summer" ? "#6cc46c" : season === "autumn" ? "#e0be7e" : "#bdd4ef",
  );
  const highCol = new THREE.Color(
    season === "spring" ? "#bef096" : season === "summer" ? "#9ee388" : season === "autumn" ? "#fae3ad" : "#e2eefb",
  );
  const brookCol = new THREE.Color("#7bcff2");
  const tmpCol = new THREE.Color();

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Map barycentric (i, j) with i + j <= segs to vertex index
  const idxMap: number[][] = [];
  let vCount = 0;
  for (let i = 0; i <= segs; i++) {
    idxMap[i] = [];
    for (let j = 0; j <= segs - i; j++) {
      const u = i / segs;
      const v = j / segs;
      const w = 1 - u - v;
      const x = ax * w + bx * u + cx * v;
      const z = az * w + bz * u + cz * v;
      const y = getTerrainY(season, x, z);
      positions.push(x, y, z);

      const hNorm = Math.min(1, Math.max(0, (y - 0.003) / 0.048));
      tmpCol.copy(lowCol).lerp(highCol, hNorm);
      if (season === "summer" && y < 0.006 && x > -0.34 && x < 0.34 && z > -0.02 && z < 0.40) {
        tmpCol.lerp(brookCol, 0.72);
      }
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      idxMap[i][j] = vCount++;
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < segs - i; j++) {
      const p00 = idxMap[i][j];
      const p10 = idxMap[i + 1][j];
      const p01 = idxMap[i][j + 1];
      if (posX) {
        indices.push(p00, p10, p01);
      } else {
        indices.push(p00, p01, p10);
      }
      if (i + j + 1 < segs) {
        const p11 = idxMap[i + 1][j + 1];
        if (posX) {
          indices.push(p10, p11, p01);
        } else {
          indices.push(p10, p01, p11);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const TERRAIN_GEOS: Record<Season, { posX: THREE.BufferGeometry; negX: THREE.BufferGeometry }> = {
  spring: { posX: createSculptedHalfTerrainGeo("spring", true), negX: createSculptedHalfTerrainGeo("spring", false) },
  summer: { posX: createSculptedHalfTerrainGeo("summer", true), negX: createSculptedHalfTerrainGeo("summer", false) },
  autumn: { posX: createSculptedHalfTerrainGeo("autumn", true), negX: createSculptedHalfTerrainGeo("autumn", false) },
  winter: { posX: createSculptedHalfTerrainGeo("winter", true), negX: createSculptedHalfTerrainGeo("winter", false) },
};

// Shared tapered 3D grass blade geometry pivoted at the base (y = 0)
function createGrassBladeGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.0055, 0);
  s.quadraticCurveTo(-0.004, 0.024, 0.001, 0.048);
  s.quadraticCurveTo(0.005, 0.024, 0.0055, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0014, bevelEnabled: false });
  geo.translate(0, 0, -0.0007);
  return geo;
}

// Shared slender golden wheat stalk + drooping ear geometry for Autumn InstancedMesh
function createWheatGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.0022, 0);
  s.lineTo(-0.0016, 0.056);
  s.quadraticCurveTo(0.006, 0.072, 0.011, 0.062);
  s.quadraticCurveTo(0.007, 0.050, 0.0018, 0.052);
  s.lineTo(0.0022, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0028, bevelEnabled: false });
  geo.translate(0, 0, -0.0014);
  return geo;
}

const GRASS_BLADE_GEO = createGrassBladeGeo();
const WHEAT_STALK_GEO = createWheatGeo();
const BLOB_GEO = new THREE.IcosahedronGeometry(1, 1);

// Exact half-dome geometries split cleanly along x = 0
const HALF_MOUND_POS_X_GEO = new THREE.SphereGeometry(1, 16, 10, Math.PI / 2, Math.PI, 0, Math.PI * 0.5);
const HALF_MOUND_NEG_X_GEO = new THREE.SphereGeometry(1, 16, 10, -Math.PI / 2, Math.PI, 0, Math.PI * 0.5);

function BrightMat({
  color,
  boost = 0.34,
  opacity = 1,
}: {
  color: string;
  boost?: number;
  opacity?: number;
}) {
  return (
    <meshLambertMaterial
      color={color}
      emissive={color}
      emissiveIntensity={boost}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

type CircleZone = [number, number, number];
type PathStone = { x: number; z: number; sx: number; sz: number; ry: number; col: string };

function isClear(x: number, z: number, zones: CircleZone[], maxManh = 0.668): boolean {
  if (Math.abs(x) + Math.abs(z - 0.028) > maxManh) return false;
  for (const [cx, cz, r] of zones) {
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}

function isOnPath(x: number, z: number, stones: PathStone[], pad = 0.062): boolean {
  for (const st of stones) {
    const dx = x - st.x;
    const dz = z - st.z;
    if (dx * dx + dz * dz < pad * pad) return true;
  }
  return false;
}

const SEASON_PATHS: Record<Season, PathStone[]> = {
  spring: [
    { x: 0.01, z: 0.63, sx: 0.044, sz: 0.036, ry: 0.15, col: "#f5ede0" },
    { x: -0.02, z: 0.55, sx: 0.048, sz: 0.038, ry: -0.22, col: "#ede3d2" },
    { x: -0.04, z: 0.47, sx: 0.046, sz: 0.038, ry: 0.12, col: "#f7f0e3" },
    { x: -0.01, z: 0.39, sx: 0.048, sz: 0.040, ry: -0.18, col: "#efe6d6" },
    { x: 0.03, z: 0.31, sx: 0.046, sz: 0.038, ry: 0.28, col: "#f5ede0" },
    { x: 0.02, z: 0.23, sx: 0.044, sz: 0.036, ry: -0.10, col: "#eee4d3" },
    { x: -0.09, z: 0.22, sx: 0.034, sz: 0.028, ry: 0.45, col: "#f2e9da" },
    { x: -0.17, z: 0.19, sx: 0.032, sz: 0.026, ry: 0.30, col: "#ebe1ce" },
    { x: 0.11, z: 0.20, sx: 0.034, sz: 0.028, ry: -0.40, col: "#f5ede0" },
    { x: 0.19, z: 0.17, sx: 0.032, sz: 0.026, ry: -0.28, col: "#ede3d2" },
  ],
  summer: [
    { x: -0.01, z: 0.63, sx: 0.046, sz: 0.036, ry: -0.14, col: "#f2eadb" },
    { x: 0.02, z: 0.55, sx: 0.048, sz: 0.038, ry: 0.20, col: "#e8decb" },
    { x: 0.03, z: 0.47, sx: 0.046, sz: 0.038, ry: -0.10, col: "#f5efe2" },
    { x: 0.01, z: 0.39, sx: 0.046, sz: 0.036, ry: 0.16, col: "#ece3d3" },
    // Wooden arched footbridge crosses the brook around z = 0.25..0.33!
    { x: -0.02, z: 0.18, sx: 0.044, sz: 0.034, ry: -0.14, col: "#eae0ce" },
    { x: -0.10, z: 0.22, sx: 0.035, sz: 0.028, ry: 0.36, col: "#f0e7d8" },
    { x: -0.17, z: 0.20, sx: 0.032, sz: 0.026, ry: 0.22, col: "#e8decb" },
  ],
  autumn: [
    { x: 0.00, z: 0.63, sx: 0.046, sz: 0.036, ry: 0.12, col: "#e8cba8" },
    { x: -0.03, z: 0.55, sx: 0.048, sz: 0.038, ry: -0.20, col: "#dfb992" },
    { x: -0.03, z: 0.47, sx: 0.046, sz: 0.038, ry: 0.15, col: "#ebd0ae" },
    { x: 0.00, z: 0.39, sx: 0.048, sz: 0.038, ry: -0.16, col: "#e3c19b" },
    { x: 0.03, z: 0.31, sx: 0.046, sz: 0.038, ry: 0.22, col: "#e9cca9" },
    { x: 0.02, z: 0.23, sx: 0.044, sz: 0.036, ry: -0.12, col: "#e0bc95" },
    { x: 0.11, z: 0.18, sx: 0.036, sz: 0.028, ry: -0.42, col: "#e8cba8" },
    { x: 0.18, z: 0.10, sx: 0.036, sz: 0.028, ry: -0.55, col: "#dfb992" },
    { x: 0.23, z: 0.02, sx: 0.034, sz: 0.028, ry: -0.45, col: "#ebd0ae" },
    { x: -0.10, z: 0.22, sx: 0.034, sz: 0.028, ry: 0.38, col: "#e3c19b" },
  ],
  winter: [
    { x: 0.00, z: 0.63, sx: 0.044, sz: 0.035, ry: 0.10, col: "#b9d0ea" },
    { x: -0.02, z: 0.55, sx: 0.046, sz: 0.036, ry: -0.18, col: "#aec7e4" },
    { x: -0.03, z: 0.47, sx: 0.045, sz: 0.036, ry: 0.14, col: "#c2d7ef" },
    { x: 0.00, z: 0.39, sx: 0.046, sz: 0.036, ry: -0.12, col: "#b5cde8" },
    { x: 0.02, z: 0.31, sx: 0.044, sz: 0.035, ry: 0.20, col: "#bfd4ec" },
    { x: 0.01, z: 0.23, sx: 0.042, sz: 0.034, ry: -0.08, col: "#b1c9e6" },
    { x: 0.11, z: 0.16, sx: 0.034, sz: 0.026, ry: -0.45, col: "#b9d0ea" },
    { x: 0.18, z: 0.08, sx: 0.034, sz: 0.026, ry: -0.52, col: "#aec7e4" },
    { x: 0.23, z: 0.00, sx: 0.032, sz: 0.026, ry: -0.48, col: "#c2d7ef" },
  ],
};

const BASE_ZONES: CircleZone[] = [
  [0, 0, 0.19],
  [0.0, -0.36, 0.14],
];

const SEASON_ZONES: Record<Season, CircleZone[]> = {
  spring: [
    ...BASE_ZONES,
    [-0.28, 0.16, 0.135],
    [0.26, 0.14, 0.065],
    [0.34, -0.06, 0.065],
    [-0.13, 0.30, 0.065],
    [0.15, 0.28, 0.065],
  ],
  summer: [
    ...BASE_ZONES,
    [0.24, 0.18, 0.175],
    [-0.24, 0.18, 0.11],
    [-0.36, 0.07, 0.095],
    [0.31, 0.06, 0.085],
    [0.13, 0.31, 0.065],
    [0.01, 0.28, 0.085], // wooden arched footbridge
  ],
  autumn: [
    ...BASE_ZONES,
    [0.31, -0.09, 0.135],
    [-0.22, 0.20, 0.10],
    [-0.35, 0.04, 0.095],
    [-0.31, -0.10, 0.06],
    [0.24, 0.20, 0.10],
  ],
  winter: [
    ...BASE_ZONES,
    [0.31, -0.09, 0.135],
    [-0.23, 0.19, 0.085],
    [0.24, 0.18, 0.155],
    [-0.33, 0.04, 0.085],
    [0.35, 0.10, 0.065],
    [0.11, 0.31, 0.08],
  ],
};

interface BladeInstance {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  col: string;
}

export default function SeasonGroundCover3D({
  season,
  side = "all",
}: {
  season: Season;
  side?: "all" | "posX" | "negX";
}) {
  const bladeMeshRef = useRef<THREE.InstancedMesh>(null);
  const wheatMeshRef = useRef<THREE.InstancedMesh>(null);
  const keepX = (x: number) => (side === "all" ? true : side === "posX" ? x >= 0 : x < 0);

  const floorCfg = useMemo(() => {
    switch (season) {
      case "spring":
        return { terrainEmissive: "#60a850", terrainBoost: 0.16, mound: "#c2eba8", moundBoost: 0.30, bladeEmissive: "#88d878", bladeBoost: 0.30 };
      case "summer":
        return { terrainEmissive: "#48984e", terrainBoost: 0.15, mound: "#9be08a", moundBoost: 0.28, bladeEmissive: "#60bf64", bladeBoost: 0.28 };
      case "autumn":
        return { terrainEmissive: "#c29448", terrainBoost: 0.16, mound: "#f7e0ac", moundBoost: 0.28, bladeEmissive: "#e3b652", bladeBoost: 0.30 };
      case "winter":
        return { terrainEmissive: "#88a8cf", terrainBoost: 0.12, mound: "#cde0f4", moundBoost: 0.14, bladeEmissive: "#bfd6f0", bladeBoost: 0.20 };
    }
  }, [season]);

  const data = useMemo(() => {
    const seed = season === "spring" ? 1108 : season === "summer" ? 2208 : season === "autumn" ? 3308 : 4408;
    const r = makeRng(seed);
    const zones = SEASON_ZONES[season];
    const path = SEASON_PATHS[season];

    const blades: BladeInstance[] = [];
    const wheat: BladeInstance[] = [];

    const bladePalette =
      season === "spring"
        ? ["#79ce70", "#92df7b", "#aee986", "#6ac266", "#a2e582", "#c2ee8e"]
        : season === "summer"
          ? ["#4eb55c", "#62c468", "#78d474", "#42a352", "#88de7e", "#58bc62"]
          : season === "autumn"
            ? ["#e6b852", "#d99e46", "#f2c960", "#cc8c3e", "#f0ba4e"]
            : ["#bed2ea", "#d0e2f5", "#b2c8e2", "#dceafb"];

    const wheatPalette = ["#f5c851", "#ffd866", "#e8b343", "#ffcb57", "#f0ba48", "#f7b249"];

    const isSummerBrook = (x: number, z: number) => {
      if (season !== "summer") return false;
      const brookZ = 0.28 - (x + 0.10) * 0.32;
      return x > -0.34 && x < 0.30 && Math.abs(z - brookZ) < 0.068;
    };

    const step = season === "winter" ? 0.115 : 0.078;
    for (let gx = -0.66; gx <= 0.66; gx += step) {
      for (let gz = -0.60; gz <= 0.69; gz += step) {
        const cx = gx + (r() - 0.5) * (step * 0.62);
        const cz = gz + (r() - 0.5) * (step * 0.62);
        if (!isClear(cx, cz, zones, 0.670)) continue;
        if (isOnPath(cx, cz, path, 0.062) || isSummerBrook(cx, cz)) continue;
        if (season === "winter" && r() < 0.24) continue;

        if (season === "autumn") {
          const isWheatPatch = r() < 0.72;
          const cnt = isWheatPatch ? 3 + Math.floor(r() * 3) : 4 + Math.floor(r() * 2);
          for (let bi = 0; bi < cnt; bi++) {
            const ba = (bi / cnt) * Math.PI * 2 + r() * 0.55;
            const dist = 0.006 + r() * 0.025;
            const bx = cx + Math.cos(ba) * dist;
            const bz = cz + Math.sin(ba) * dist;
            if (!isClear(bx, bz, zones, 0.676) || isOnPath(bx, bz, path, 0.060)) continue;
            const item: BladeInstance = {
              x: bx,
              y: getTerrainY(season, bx, bz),
              z: bz,
              rx: 0.10 + r() * 0.18,
              ry: ba,
              rz: (r() - 0.5) * 0.22,
              sx: 0.88 + r() * 0.35,
              sy: isWheatPatch ? 0.85 + r() * 0.55 : 0.60 + r() * 0.45,
              col: isWheatPatch
                ? wheatPalette[Math.floor(r() * wheatPalette.length)]
                : bladePalette[Math.floor(r() * bladePalette.length)],
            };
            if (isWheatPatch) wheat.push(item);
            else blades.push(item);
          }
        } else {
          const cnt = season === "winter" ? 3 : 4 + Math.floor(r() * 3);
          for (let bi = 0; bi < cnt; bi++) {
            const ba = (bi / cnt) * Math.PI * 2 + r() * 0.55;
            const dist = 0.006 + r() * 0.024;
            const bx = cx + Math.cos(ba) * dist;
            const bz = cz + Math.sin(ba) * dist;
            if (!isClear(bx, bz, zones, 0.676) || isOnPath(bx, bz, path, 0.060) || isSummerBrook(bx, bz)) continue;
            blades.push({
              x: bx,
              y: getTerrainY(season, bx, bz),
              z: bz,
              rx: season === "summer" ? 0.18 + r() * 0.28 : 0.14 + r() * 0.24,
              ry: ba,
              rz: (r() - 0.5) * 0.24,
              sx: season === "summer" ? 0.95 + r() * 0.45 : 0.85 + r() * 0.38,
              sy: season === "summer" ? 0.78 + r() * 0.75 : season === "winter" ? 0.55 + r() * 0.42 : 0.62 + r() * 0.68,
              col: bladePalette[Math.floor(r() * bladePalette.length)],
            });
          }
        }
      }
    }

    const pathPebbles: { x: number; y: number; z: number; s: number; col: string }[] = [];
    for (const st of path) {
      for (const sgn of [-1, 1]) {
        if (r() < 0.35) continue;
        const px = st.x + sgn * (st.sx + 0.012 + r() * 0.012);
        const pz = st.z + (r() - 0.5) * 0.032;
        if (Math.abs(px) + Math.abs(pz - 0.028) > 0.67) continue;
        const col =
          season === "winter"
            ? r() < 0.5
              ? "#c6dcf4"
              : "#b6cfe9"
            : season === "autumn"
              ? r() < 0.5
                ? "#d6b08c"
                : "#c9a07b"
              : r() < 0.5
                ? "#e6decb"
                : "#d9d1c0";
        pathPebbles.push({ x: px, y: getTerrainY(season, px, pz) + 0.002, z: pz, s: 0.009 + r() * 0.006, col });
      }
    }

    const dandelions: { x: number; y: number; z: number; h: number }[] = [];
    const flowerClusters: { x: number; y: number; z: number; stems: { dx: number; dz: number; h: number; col: string; sz: number }[] }[] = [];
    const petals: { x: number; y: number; z: number; ry: number; s: number; col: string }[] = [];
    if (season === "spring") {
      for (let tries = 0; tries < 120 && dandelions.length < 18; tries++) {
        const cx = (r() - 0.5) * 1.18;
        const cz = -0.15 + r() * 0.78;
        if (!isClear(cx, cz, zones, 0.64) || isOnPath(cx, cz, path)) continue;
        const n = 2 + (r() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const x = cx + (r() - 0.5) * 0.038;
          const z = cz + (r() - 0.5) * 0.038;
          if (!isClear(x, z, zones, 0.65) || isOnPath(x, z, path)) continue;
          dandelions.push({ x, y: getTerrainY("spring", x, z), z, h: 0.038 + r() * 0.034 });
        }
      }
      const flowerPalettes = [
        ["#ffa8cb", "#ffc4dd", "#ffe8f2"],
        ["#ffe278", "#fff0a6", "#ffffff"],
        ["#a8d4ff", "#cce6ff", "#ffffff"],
        ["#d4b8ff", "#e8d6ff", "#ffcce2"],
        ["#ffb899", "#ffd8b8", "#fff0c4"],
      ];
      for (let tries = 0; tries < 280 && flowerClusters.length < 22; tries++) {
        const x = (r() - 0.5) * 1.24;
        const z = (r() - 0.5) * 1.20;
        if (!isClear(x, z, zones, 0.65) || isOnPath(x, z, path)) continue;
        if (flowerClusters.some((fc) => (fc.x - x) ** 2 + (fc.z - z) ** 2 < 0.095 * 0.095)) continue;
        const pal = flowerPalettes[Math.floor(r() * flowerPalettes.length)];
        const count = 4 + (r() < 0.5 ? 1 : 0);
        const stems = Array.from({ length: count }, (_, k) => {
          const a = (k / count) * Math.PI * 2 + r() * 0.6;
          const d = k === 0 ? 0 : 0.015 + r() * 0.016;
          return {
            dx: Math.cos(a) * d,
            dz: Math.sin(a) * d,
            h: 0.024 + r() * 0.026,
            col: pal[Math.floor(r() * pal.length)],
            sz: 0.0085 + r() * 0.0045,
          };
        });
        flowerClusters.push({ x, y: getTerrainY("spring", x, z), z, stems });
      }
      const pCols = ["#ffc2da", "#ffd9e8", "#ffa8ca", "#ffeaf2"];
      for (let i = 0; i < 48; i++) {
        const ang = r() * Math.PI * 2;
        const dist = 0.09 + r() * 0.50;
        const x = Math.cos(ang) * dist;
        const z = Math.sin(ang) * dist;
        if (Math.abs(x) + Math.abs(z - 0.028) > 0.65) continue;
        petals.push({ x, y: getTerrainY("spring", x, z) + 0.004, z, ry: r() * 6.28, s: 0.68 + r() * 0.65, col: pCols[Math.floor(r() * pCols.length)] });
      }
    }

    const summerFlowers: { x: number; y: number; z: number; col: string; h: number }[] = [];
    if (season === "summer") {
      const fCols = ["#ffffff", "#fff3a6", "#a8dcff", "#ffffff", "#ffe0f0"];
      for (let tries = 0; tries < 260 && summerFlowers.length < 28; tries++) {
        const x = (r() - 0.5) * 1.24;
        const z = (r() - 0.5) * 1.20;
        if (!isClear(x, z, zones, 0.64) || isOnPath(x, z, path) || isSummerBrook(x, z)) continue;
        summerFlowers.push({ x, y: getTerrainY("summer", x, z), z, col: fCols[Math.floor(r() * fCols.length)], h: 0.032 + r() * 0.024 });
      }
    }

    const autumnShrubs: { x: number; y: number; z: number; s: number; col: string }[] =
      season === "autumn"
        ? [
            { x: -0.36, z: -0.18, s: 0.042, col: "#f07b52" },
            { x: -0.16, z: -0.26, s: 0.038, col: "#f7ab54" },
            { x: 0.18, z: -0.26, s: 0.038, col: "#eb6c4e" },
            { x: 0.48, z: -0.02, s: 0.035, col: "#f7c25c" },
            { x: -0.48, z: 0.12, s: 0.036, col: "#f28c52" },
            { x: 0.42, z: 0.14, s: 0.036, col: "#f79f56" },
            { x: -0.14, z: 0.50, s: 0.032, col: "#ed7550" },
            { x: 0.14, z: 0.48, s: 0.032, col: "#f7b054" },
            { x: -0.32, z: 0.30, s: 0.034, col: "#f08054" },
            { x: 0.48, z: 0.08, s: 0.030, col: "#f2924e" },
          ].map((sh) => ({ ...sh, y: getTerrainY("autumn", sh.x, sh.z) + sh.s * 0.48 }))
        : [];
    const acorns: { x: number; y: number; z: number; ry: number }[] = [];
    if (season === "autumn") {
      for (let tries = 0; tries < 140 && acorns.length < 20; tries++) {
        const x = (r() - 0.5) * 1.16;
        const z = -0.18 + r() * 0.78;
        if (!isClear(x, z, zones, 0.64) || isOnPath(x, z, path)) continue;
        acorns.push({ x, y: getTerrainY("autumn", x, z) + 0.007, z, ry: r() * 6.28 });
      }
    }

    const snowdrifts: { x: number; y: number; z: number; sx: number; sy: number; sz: number; col: string }[] =
      season === "winter"
        ? [
            { x: -0.16, z: 0.08, sx: 0.095, sy: 0.022, sz: 0.075, col: "#dce9f8" },
            { x: 0.14, z: 0.04, sx: 0.09, sy: 0.020, sz: 0.07, col: "#cfe0f4" },
            { x: -0.42, z: 0.16, sx: 0.088, sy: 0.024, sz: 0.07, col: "#d8e7f7" },
            { x: -0.16, z: 0.36, sx: 0.082, sy: 0.020, sz: 0.065, col: "#ccdcf2" },
            { x: 0.42, z: -0.06, sx: 0.088, sy: 0.024, sz: 0.07, col: "#dce9f8" },
            { x: 0.04, z: -0.24, sx: 0.10, sy: 0.026, sz: 0.075, col: "#d2e2f6" },
            { x: -0.38, z: -0.12, sx: 0.085, sy: 0.022, sz: 0.068, col: "#ccdcf2" },
            { x: 0.26, z: 0.34, sx: 0.078, sy: 0.020, sz: 0.062, col: "#d8e7f7" },
            { x: -0.14, z: 0.50, sx: 0.075, sy: 0.018, sz: 0.058, col: "#cfe0f4" },
            { x: 0.44, z: 0.18, sx: 0.075, sy: 0.020, sz: 0.06, col: "#dce9f8" },
            { x: -0.52, z: 0.04, sx: 0.082, sy: 0.022, sz: 0.064, col: "#d4e4f7" },
            { x: 0.52, z: 0.04, sx: 0.080, sy: 0.022, sz: 0.062, col: "#cfe0f4" },
            { x: -0.28, z: 0.30, sx: 0.078, sy: 0.020, sz: 0.062, col: "#d8e7f7" },
            { x: 0.14, z: 0.50, sx: 0.072, sy: 0.018, sz: 0.056, col: "#d2e2f6" },
          ].map((sd) => ({ ...sd, y: getTerrainY("winter", sd.x, sd.z) + 0.002 }))
        : [];
    const snowShrubs: { x: number; y: number; z: number; s: number }[] =
      season === "winter"
        ? [
            { x: -0.38, z: -0.08, s: 0.036 },
            { x: -0.14, z: 0.28, s: 0.032 },
            { x: 0.46, z: -0.04, s: 0.034 },
            { x: 0.16, z: -0.02, s: 0.030 },
            { x: -0.44, z: 0.15, s: 0.030 },
            { x: 0.24, z: 0.34, s: 0.028 },
            { x: -0.50, z: 0.06, s: 0.028 },
            { x: -0.14, z: 0.48, s: 0.028 },
            { x: 0.14, z: 0.48, s: 0.028 },
            { x: -0.28, z: -0.22, s: 0.032 },
          ].map((sh) => ({ ...sh, y: getTerrainY("winter", sh.x, sh.z) + sh.s * 0.45 }))
        : [];
    const footprints: { x: number; y: number; z: number; ry: number }[] =
      season === "winter"
        ? [
            { x: -0.07, z: 0.32, ry: -0.6 },
            { x: -0.10, z: 0.29, ry: -0.65 },
            { x: -0.13, z: 0.27, ry: -0.7 },
            { x: -0.16, z: 0.24, ry: -0.75 },
            { x: -0.19, z: 0.22, ry: -0.7 },
          ].map((fp) => ({ ...fp, y: getTerrainY("winter", fp.x, fp.z) + 0.003 }))
        : [];
    const iceCrystals: { x: number; y: number; z: number; s: number; ry: number }[] =
      season === "winter"
        ? [
            { x: 0.11, z: 0.20, s: 0.016, ry: 0.4 },
            { x: 0.13, z: 0.14, s: 0.013, ry: 1.1 },
            { x: 0.36, z: 0.20, s: 0.015, ry: 2.0 },
            { x: 0.31, z: 0.26, s: 0.012, ry: 0.8 },
            { x: 0.18, z: 0.28, s: 0.014, ry: 1.7 },
            { x: 0.32, z: 0.12, s: 0.012, ry: 2.6 },
            { x: -0.09, z: 0.46, s: 0.013, ry: 0.9 },
            { x: 0.26, z: 0.38, s: 0.012, ry: 1.9 },
            { x: -0.32, z: 0.26, s: 0.013, ry: 2.3 },
            { x: 0.46, z: 0.12, s: 0.013, ry: 0.5 },
          ].map((ic) => ({ ...ic, y: getTerrainY("winter", ic.x, ic.z) + ic.s * 0.65 }))
        : [];

    return {
      blades: blades.filter((it) => keepX(it.x)),
      wheat: wheat.filter((it) => keepX(it.x)),
      pathStones: path.filter((it) => keepX(it.x)).map((st) => ({ ...st, y: getTerrainY(season, st.x, st.z) + 0.004 })),
      pathPebbles: pathPebbles.filter((it) => keepX(it.x)),
      dandelions: dandelions.filter((it) => keepX(it.x)),
      flowerClusters: flowerClusters.filter((it) => keepX(it.x)),
      petals: petals.filter((it) => keepX(it.x)),
      summerFlowers: summerFlowers.filter((it) => keepX(it.x)),
      autumnShrubs: autumnShrubs.filter((it) => keepX(it.x)),
      acorns: acorns.filter((it) => keepX(it.x)),
      snowdrifts: snowdrifts.filter((it) => keepX(it.x)),
      snowShrubs: snowShrubs.filter((it) => keepX(it.x)),
      footprints: footprints.filter((it) => keepX(it.x)),
      iceCrystals: iceCrystals.filter((it) => keepX(it.x)),
    };
  }, [season, side]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    if (bladeMeshRef.current && data.blades.length > 0) {
      data.blades.forEach((b, i) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(b.rx, b.ry, b.rz);
        dummy.scale.set(b.sx, b.sy, b.sx);
        dummy.updateMatrix();
        bladeMeshRef.current!.setMatrixAt(i, dummy.matrix);
        color.set(b.col);
        bladeMeshRef.current!.setColorAt(i, color);
      });
      bladeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (bladeMeshRef.current.instanceColor) bladeMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (wheatMeshRef.current && data.wheat.length > 0) {
      data.wheat.forEach((w, i) => {
        dummy.position.set(w.x, w.y, w.z);
        dummy.rotation.set(w.rx, w.ry, w.rz);
        dummy.scale.set(w.sx, w.sy, w.sx);
        dummy.updateMatrix();
        wheatMeshRef.current!.setMatrixAt(i, dummy.matrix);
        color.set(w.col);
        wheatMeshRef.current!.setColorAt(i, color);
      });
      wheatMeshRef.current.instanceMatrix.needsUpdate = true;
      if (wheatMeshRef.current.instanceColor) wheatMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [data]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const gust = book.weatherAlt ? 1.30 : 1.0;
    const amp = (season === "winter" ? 0.012 : 0.024) * gust;
    if (bladeMeshRef.current) {
      bladeMeshRef.current.rotation.z = Math.sin(t * (1.7 * gust)) * amp;
      bladeMeshRef.current.rotation.x = Math.cos(t * (1.3 * gust)) * amp * 0.6;
    }
    if (wheatMeshRef.current) {
      wheatMeshRef.current.rotation.z = Math.sin(t * (2.0 * gust)) * 0.038 * gust;
      wheatMeshRef.current.rotation.x = Math.cos(t * (1.6 * gust)) * 0.022 * gust;
    }
  });

  const terrainGeos = TERRAIN_GEOS[season];

  return (
    <group>
      {/* 1. Sculpted 3D vertex-colored origami terrain covering all 4 corners */}
      {(side === "all" || side === "posX") && (
        <mesh geometry={terrainGeos.posX}>
          <meshLambertMaterial
            vertexColors
            emissive={floorCfg.terrainEmissive}
            emissiveIntensity={floorCfg.terrainBoost}
          />
        </mesh>
      )}
      {(side === "all" || side === "negX") && (
        <mesh geometry={terrainGeos.negX}>
          <meshLambertMaterial
            vertexColors
            emissive={floorCfg.terrainEmissive}
            emissiveIntensity={floorCfg.terrainBoost}
          />
        </mesh>
      )}

      {/* 2. Seamless split root mound merging along x = 0 */}
      {(side === "all" || side === "posX") && (
        <mesh geometry={HALF_MOUND_POS_X_GEO} position={[0, 0.008, 0]} scale={[0.22, 0.044, 0.22]}>
          <BrightMat color={floorCfg.mound} boost={floorCfg.moundBoost} />
        </mesh>
      )}
      {(side === "all" || side === "negX") && (
        <mesh geometry={HALF_MOUND_NEG_X_GEO} position={[0, 0.008, 0]} scale={[0.22, 0.044, 0.22]}>
          <BrightMat color={floorCfg.mound} boost={floorCfg.moundBoost} />
        </mesh>
      )}

      {/* 3. Summer crystal brook water surface & cute arched wooden footbridge */}
      {season === "summer" && (side === "all" || side === "posX") && (
        <group position={[0.02, 0.011, 0.26]} rotation={[0, 0.30, 0]}>
          {/* Shimmering shallow brook ribbon flowing into the right pond */}
          <mesh position={[0.08, -0.001, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.092]} />
            <BrightMat color="#7ed8fa" boost={0.44} opacity={0.86} />
          </mesh>
          {/* Cute Arched Wooden Footbridge spanning the brook */}
          <group position={[-0.01, 0.004, 0.02]} rotation={[0, -0.32, 0]}>
            {[-0.045, -0.027, -0.009, 0.009, 0.027, 0.045].map((pz, idx) => {
              const arch = Math.cos((pz / 0.055) * (Math.PI / 2)) * 0.018;
              return (
                <mesh key={idx} position={[0, arch + 0.006, pz]}>
                  <boxGeometry args={[0.072, 0.006, 0.015]} />
                  <BrightMat color={idx % 2 === 0 ? "#e6bc8a" : "#d9ac78"} boost={0.34} />
                </mesh>
              );
            })}
            {/* Side handrails & posts */}
            {[-0.036, 0.036].map((rx, sIdx) => (
              <group key={sIdx}>
                {[-0.042, 0, 0.042].map((pz, pIdx) => {
                  const arch = Math.cos((pz / 0.055) * (Math.PI / 2)) * 0.018;
                  return (
                    <mesh key={pIdx} position={[rx, arch + 0.022, pz]}>
                      <boxGeometry args={[0.006, 0.032, 0.006]} />
                      <BrightMat color="#c79564" boost={0.30} />
                    </mesh>
                  );
                })}
                <mesh position={[rx, 0.046, 0]}>
                  <boxGeometry args={[0.006, 0.006, 0.095]} />
                  <BrightMat color="#dba876" boost={0.32} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      )}
      {season === "summer" && (side === "all" || side === "negX") && (
        <mesh position={[-0.14, 0.010, 0.30]} rotation={[-Math.PI / 2, 0, -0.30]}>
          <planeGeometry args={[0.24, 0.088]} />
          <BrightMat color="#7ed8fa" boost={0.44} opacity={0.86} />
        </mesh>
      )}

      {/* 4. Season-specific winding garden footpath hugging the sculpted hills */}
      {data.pathStones.map((st, i) => (
        <mesh
          key={`pst-${i}`}
          position={[st.x, st.y, st.z]}
          rotation={[0, st.ry, 0]}
          scale={[st.sx, 0.009, st.sz]}
        >
          <cylinderGeometry args={[1, 1.08, 1, 10]} />
          <BrightMat color={st.col} boost={season === "winter" ? 0.16 : 0.34} />
        </mesh>
      ))}
      {data.pathPebbles.map((pb, i) => (
        <mesh
          key={`ppb-${i}`}
          geometry={BLOB_GEO}
          position={[pb.x, pb.y, pb.z]}
          scale={[pb.s * 1.2, pb.s * 0.55, pb.s]}
        >
          <BrightMat color={pb.col} boost={season === "winter" ? 0.16 : 0.32} />
        </mesh>
      ))}

      {/* 5. Full-terrain instanced clustered 3D grass / fern / frost-grass blades */}
      {data.blades.length > 0 && (
        <instancedMesh
          key={`blades-${season}-${side}-${data.blades.length}`}
          ref={bladeMeshRef}
          args={[GRASS_BLADE_GEO, undefined, data.blades.length]}
          frustumCulled={false}
        >
          <meshLambertMaterial
            color="#ffffff"
            emissive={floorCfg.bladeEmissive}
            emissiveIntensity={floorCfg.bladeBoost}
          />
        </instancedMesh>
      )}

      {/* 6. Full-terrain instanced swaying golden wheat stalks (Autumn) */}
      {data.wheat.length > 0 && (
        <instancedMesh
          key={`wheat-${season}-${side}-${data.wheat.length}`}
          ref={wheatMeshRef}
          args={[WHEAT_STALK_GEO, undefined, data.wheat.length]}
          frustumCulled={false}
        >
          <meshLambertMaterial color="#ffffff" emissive="#e8b848" emissiveIntensity={0.34} />
        </instancedMesh>
      )}

      {/* ==================== SPRING ACCENTS ==================== */}
      {season === "spring" && (
        <>
          {data.dandelions.map((d, i) => (
            <group key={`dan-${i}`} position={[d.x, d.y, d.z]}>
              <mesh position={[0, d.h / 2, 0]}>
                <cylinderGeometry args={[0.002, 0.0028, d.h, 5]} />
                <BrightMat color="#85cc78" boost={0.35} />
              </mesh>
              <mesh position={[0, d.h, 0]}>
                <sphereGeometry args={[0.011, 8, 8]} />
                <BrightMat color="#ffffff" boost={0.50} opacity={0.92} />
              </mesh>
            </group>
          ))}
          {data.flowerClusters.map((fc, i) => (
            <group key={`fc-${i}`} position={[fc.x, fc.y, fc.z]}>
              {fc.stems.map((st, si) => (
                <group key={si} position={[st.dx, 0, st.dz]}>
                  <mesh position={[0, st.h / 2, 0]}>
                    <cylinderGeometry args={[0.0018, 0.0025, st.h, 5]} />
                    <BrightMat color="#76c76e" boost={0.35} />
                  </mesh>
                  <mesh position={[0, st.h, 0]}>
                    <sphereGeometry args={[st.sz, 7, 7]} />
                    <BrightMat color={st.col} boost={0.44} />
                  </mesh>
                  <mesh position={[0, st.h + st.sz * 0.45, 0]}>
                    <sphereGeometry args={[st.sz * 0.42, 6, 6]} />
                    <BrightMat color="#ffe678" boost={0.48} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
          {data.petals.map((p, i) => (
            <mesh
              key={`pet-${i}`}
              position={[p.x, p.y, p.z]}
              rotation={[0, p.ry, 0]}
              scale={[0.016 * p.s, 0.002, 0.011 * p.s]}
            >
              <cylinderGeometry args={[1, 1, 1, 6]} />
              <BrightMat color={p.col} boost={0.44} />
            </mesh>
          ))}
        </>
      )}

      {/* ==================== SUMMER ACCENTS ==================== */}
      {season === "summer" &&
        data.summerFlowers.map((f, i) => (
          <group key={`sf-${i}`} position={[f.x, f.y, f.z]}>
            <mesh position={[0, f.h / 2, 0]}>
              <cylinderGeometry args={[0.0022, 0.003, f.h, 5]} />
              <BrightMat color="#5cb864" boost={0.34} />
            </mesh>
            <mesh position={[0, f.h, 0]}>
              <sphereGeometry args={[0.010, 7, 7]} />
              <BrightMat color={f.col} boost={0.46} />
            </mesh>
            <mesh position={[0, f.h + 0.004, 0]}>
              <sphereGeometry args={[0.0045, 6, 6]} />
              <BrightMat color="#ffe266" boost={0.48} />
            </mesh>
          </group>
        ))}

      {/* ==================== AUTUMN ACCENTS ==================== */}
      {season === "autumn" && (
        <>
          {data.autumnShrubs.map((sh, i) => (
            <group key={`ash-${i}`} position={[sh.x, sh.y, sh.z]}>
              <mesh geometry={BLOB_GEO} scale={[sh.s * 1.15, sh.s * 0.78, sh.s]}>
                <BrightMat color={sh.col} boost={0.36} />
              </mesh>
              <mesh
                geometry={BLOB_GEO}
                position={[sh.s * 0.65, -sh.s * 0.12, sh.s * 0.3]}
                scale={[sh.s * 0.72, sh.s * 0.58, sh.s * 0.68]}
              >
                <BrightMat color="#ffc65c" boost={0.38} />
              </mesh>
            </group>
          ))}
          {data.acorns.map((ac, i) => (
            <group key={`ac-${i}`} position={[ac.x, ac.y, ac.z]} rotation={[0.4, ac.ry, 0.5]}>
              <mesh scale={[0.0075, 0.011, 0.0075]}>
                <sphereGeometry args={[1, 7, 7]} />
                <BrightMat color="#b57142" boost={0.30} />
              </mesh>
              <mesh position={[0, 0.007, 0]} scale={[0.0085, 0.0055, 0.0085]}>
                <sphereGeometry args={[1, 7, 7]} />
                <BrightMat color="#7d4a2d" boost={0.28} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* ==================== WINTER ACCENTS ==================== */}
      {season === "winter" && (
        <>
          {data.snowdrifts.map((sd, i) => (
            <mesh key={`sd-${i}`} geometry={BLOB_GEO} position={[sd.x, sd.y, sd.z]} scale={[sd.sx, sd.sy, sd.sz]}>
              <BrightMat color={sd.col} boost={0.14} />
            </mesh>
          ))}
          {data.snowShrubs.map((sh, i) => (
            <group key={`wsh-${i}`} position={[sh.x, sh.y, sh.z]}>
              <mesh geometry={BLOB_GEO} scale={[sh.s * 1.1, sh.s * 0.72, sh.s]}>
                <BrightMat color="#6ca384" boost={0.32} />
              </mesh>
              <mesh
                geometry={BLOB_GEO}
                position={[0, sh.s * 0.42, 0]}
                scale={[sh.s * 0.95, sh.s * 0.45, sh.s * 0.88]}
              >
                <BrightMat color="#d8e8f8" boost={0.16} />
              </mesh>
              <mesh position={[sh.s * 0.55, sh.s * 0.15, sh.s * 0.55]}>
                <sphereGeometry args={[0.006, 6, 6]} />
                <BrightMat color="#f05a62" boost={0.42} />
              </mesh>
            </group>
          ))}
          {data.footprints.map((fp, i) => (
            <mesh
              key={`fp-${i}`}
              position={[fp.x, fp.y, fp.z]}
              rotation={[0, fp.ry, 0]}
              scale={[0.011, 0.002, 0.017]}
            >
              <cylinderGeometry args={[1, 1, 1, 8]} />
              <BrightMat color="#b4cde8" boost={0.20} />
            </mesh>
          ))}
          {data.iceCrystals.map((ic, i) => (
            <mesh
              key={`ic-${i}`}
              position={[ic.x, ic.y, ic.z]}
              rotation={[0.15, ic.ry, 0.2]}
              scale={[ic.s * 0.65, ic.s * 1.4, ic.s * 0.65]}
            >
              <octahedronGeometry args={[1, 0]} />
              <BrightMat color="#cceeff" boost={0.42} opacity={0.88} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
