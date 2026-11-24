"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Season } from "./SeasonTree3D";

function makeRng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

const GRASS_BLADE_GEO = createGrassBladeGeo();
const BLOB_GEO = new THREE.IcosahedronGeometry(1, 1);
// Exact half-dome geometries split cleanly along x = 0 so the two halves hug both folded floor triangles
// and merge seamlessly into one complete round root mound when the page opens flat!
const HALF_MOUND_POS_X_GEO = new THREE.SphereGeometry(1, 16, 10, Math.PI / 2, Math.PI, 0, Math.PI * 0.5);
const HALF_MOUND_NEG_X_GEO = new THREE.SphereGeometry(1, 16, 10, -Math.PI / 2, Math.PI, 0, Math.PI * 0.5);

function BrightMat({
  color,
  boost = 0.36,
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

type CircleZone = [number, number, number]; // [cx, cz, radius]

function isClear(x: number, z: number, zones: CircleZone[], maxManh = 0.60): boolean {
  if (Math.abs(x) + Math.abs(z) > maxManh) return false;
  for (const [cx, cz, r] of zones) {
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}

// Shared exclusion zones (tree root mound + stepping stones + back hills)
const BASE_ZONES: CircleZone[] = [
  [0, 0, 0.14], // central tree mound
  [0.02, 0.36, 0.06], // stepping stone 1
  [-0.03, 0.27, 0.055], // stepping stone 2
  [0.01, 0.19, 0.052], // stepping stone 3
  [0.0, -0.36, 0.14], // back center hill
];

const SEASON_ZONES: Record<Season, CircleZone[]> = {
  spring: [
    ...BASE_ZONES,
    [-0.28, 0.16, 0.135], // picnic blanket
    [0.26, 0.14, 0.065], // windmill
    [0.34, -0.06, 0.065], // mailbox
    [-0.13, 0.30, 0.065], // mushrooms
    [0.15, 0.28, 0.065], // trellis
  ],
  summer: [
    ...BASE_ZONES,
    [0.24, 0.18, 0.175], // lotus pond
    [-0.24, 0.18, 0.11], // park bench
    [-0.36, 0.07, 0.095], // beach umbrella + table
    [0.31, 0.06, 0.085], // waterwheel on pond bank
    [0.13, 0.31, 0.065], // watermelon & bucket
  ],
  autumn: [
    ...BASE_ZONES,
    [0.31, -0.09, 0.135], // cottage
    [-0.22, 0.20, 0.10], // pumpkins
    [-0.35, 0.04, 0.095], // wheelbarrow
    [-0.31, -0.10, 0.06], // scarecrow
    [0.24, 0.20, 0.10], // hay bales
  ],
  winter: [
    ...BASE_ZONES,
    [0.31, -0.09, 0.135], // snowy cottage
    [-0.23, 0.19, 0.085], // snowman
    [0.24, 0.18, 0.155], // frozen pond
    [-0.33, 0.04, 0.085], // campfire
    [0.35, 0.10, 0.065], // streetlamp & skis
    [0.11, 0.31, 0.08], // sled
  ],
};

export default function SeasonGroundCover3D({
  season,
  side = "all",
}: {
  season: Season;
  side?: "all" | "posX" | "negX";
}) {
  const swayRefs = useRef<(THREE.Group | null)[]>([]);
  const keepX = (x: number) => (side === "all" ? true : side === "posX" ? x >= 0 : x < 0);

  // Seamless origami-split root mound: posX half hugs O-A-P, negX half hugs O-P-B, merging along x = 0!
  const moundColor =
    season === "spring"
      ? "#c7ebb0"
      : season === "summer"
        ? "#a6e08b"
        : season === "autumn"
          ? "#fce1a2"
          : "#cfe0f4";
  const moundBoost = season === "winter" ? 0.14 : 0.32;
  const splitMoundEl = (
    <group>
      {(side === "all" || side === "posX") && (
        <mesh geometry={HALF_MOUND_POS_X_GEO} position={[0, 0.001, 0]} scale={[0.22, 0.044, 0.22]}>
          <BrightMat color={moundColor} boost={moundBoost} />
        </mesh>
      )}
      {(side === "all" || side === "negX") && (
        <mesh geometry={HALF_MOUND_NEG_X_GEO} position={[0, 0.001, 0]} scale={[0.22, 0.044, 0.22]}>
          <BrightMat color={moundColor} boost={moundBoost} />
        </mesh>
      )}
    </group>
  );

  // 1. SPRING: Dense lush meadow of ~125 swaying grass tufts + dandelions + tiny buds + cherry petals
  const springData = useMemo(() => {
    const r = makeRng(1101);
    const zones = SEASON_ZONES.spring;
    const grassCols = ["#8fd97c", "#a8e685", "#7bc972", "#bce88c", "#95de7e", "#c9f094"];
    const tufts: { x: number; z: number; s: number; ry: number; col: string; phase: number }[] = [];
    // Stratified jittered grid covers EVERY open corner evenly with zero bald spots!
    for (let gx = -0.60; gx <= 0.60; gx += 0.072) {
      for (let gz = -0.58; gz <= 0.58; gz += 0.072) {
        const x = gx + (r() - 0.5) * 0.056;
        const z = gz + (r() - 0.5) * 0.056;
        if (!isClear(x, z, zones, 0.625)) continue;
        if (r() < 0.16) continue; // organic breathing variation
        tufts.push({
          x,
          z,
          s: 0.65 + r() * 0.62,
          ry: r() * Math.PI * 2,
          col: grassCols[Math.floor(r() * grassCols.length)],
          phase: x * 6 + z * 5 + r() * 1.2,
        });
      }
    }

    const dandelions: { x: number; z: number; h: number }[] = [];
    for (let tries = 0; tries < 160 && dandelions.length < 16; tries++) {
      const x = (r() - 0.5) * 1.08;
      const z = -0.18 + r() * 0.72;
      if (!isClear(x, z, zones, 0.60)) continue;
      dandelions.push({ x, z, h: 0.045 + r() * 0.026 });
    }

    const buds: { x: number; z: number; col: string; h: number }[] = [];
    const bCols = ["#ffb3cf", "#ffe680", "#b8dcff", "#ffd0b0"];
    for (let tries = 0; tries < 180 && buds.length < 20; tries++) {
      const x = (r() - 0.5) * 1.10;
      const z = (r() - 0.5) * 1.05;
      if (!isClear(x, z, zones, 0.60)) continue;
      buds.push({ x, z, col: bCols[Math.floor(r() * bCols.length)], h: 0.026 + r() * 0.018 });
    }

    const petals: { x: number; z: number; ry: number; s: number; col: string }[] = [];
    const pCols = ["#ffc2da", "#ffd9e8", "#ffa8ca", "#ffeaf2"];
    for (let i = 0; i < 38; i++) {
      const ang = r() * Math.PI * 2;
      const dist = 0.09 + r() * 0.42;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (Math.abs(x) + Math.abs(z) > 0.60) continue;
      petals.push({
        x,
        z,
        ry: r() * 6.28,
        s: 0.68 + r() * 0.65,
        col: pCols[Math.floor(r() * pCols.length)],
      });
    }

    return {
      tufts: tufts.filter((it) => keepX(it.x)),
      dandelions: dandelions.filter((it) => keepX(it.x)),
      buds: buds.filter((it) => keepX(it.x)),
      petals: petals.filter((it) => keepX(it.x)),
    };
  }, [side]);

  // 2. SUMMER: Dense lush emerald grass & ferns (~120 clusters) + wild daisies + moss pads & pebbles
  const summerData = useMemo(() => {
    const r = makeRng(2202);
    const zones = SEASON_ZONES.summer;
    const grassCols = ["#58b864", "#6ec96e", "#4ca85a", "#82d478", "#62bf68", "#94de7e"];
    const tufts: { x: number; z: number; s: number; ry: number; col: string; phase: number; fern: boolean }[] = [];
    for (let gx = -0.60; gx <= 0.60; gx += 0.074) {
      for (let gz = -0.58; gz <= 0.58; gz += 0.074) {
        const x = gx + (r() - 0.5) * 0.056;
        const z = gz + (r() - 0.5) * 0.056;
        if (!isClear(x, z, zones, 0.625)) continue;
        if (r() < 0.14) continue;
        tufts.push({
          x,
          z,
          s: 0.85 + r() * 0.62,
          ry: r() * Math.PI * 2,
          col: grassCols[Math.floor(r() * grassCols.length)],
          phase: x * 5.5 + z * 4.5 + r(),
          fern: r() < 0.42,
        });
      }
    }

    const flowers: { x: number; z: number; col: string; h: number }[] = [];
    const fCols = ["#ffffff", "#fff3a6", "#a8dcff", "#ffffff", "#ffe0f0"];
    for (let tries = 0; tries < 220 && flowers.length < 26; tries++) {
      const x = (r() - 0.5) * 1.12;
      const z = (r() - 0.5) * 1.06;
      if (!isClear(x, z, zones, 0.60)) continue;
      flowers.push({
        x,
        z,
        col: fCols[Math.floor(r() * fCols.length)],
        h: 0.034 + r() * 0.024,
      });
    }

    const mossPads: { x: number; z: number; sx: number; sz: number }[] = [
      { x: 0.08, z: 0.14, sx: 0.068, sz: 0.05 },
      { x: -0.14, z: 0.26, sx: 0.062, sz: 0.048 },
      { x: 0.16, z: -0.06, sx: 0.065, sz: 0.052 },
      { x: -0.22, z: -0.06, sx: 0.072, sz: 0.05 },
      { x: 0.06, z: 0.32, sx: 0.056, sz: 0.042 },
      { x: -0.08, z: -0.20, sx: 0.068, sz: 0.052 },
      { x: -0.34, z: -0.16, sx: 0.065, sz: 0.048 },
      { x: 0.34, z: -0.16, sx: 0.062, sz: 0.046 },
      { x: -0.12, z: 0.44, sx: 0.058, sz: 0.042 },
      { x: 0.06, z: 0.48, sx: 0.055, sz: 0.042 },
      { x: -0.44, z: 0.06, sx: 0.058, sz: 0.044 },
      { x: 0.44, z: 0.04, sx: 0.056, sz: 0.044 },
    ];

    const pebbles: { x: number; z: number; s: number; col: string }[] = [
      { x: 0.07, z: 0.23, s: 0.015, col: "#dcd7cc" },
      { x: 0.09, z: 0.25, s: 0.011, col: "#e8e3d8" },
      { x: -0.09, z: 0.29, s: 0.014, col: "#d5d0c5" },
      { x: -0.06, z: 0.34, s: 0.012, col: "#e4dfd5" },
      { x: 0.05, z: 0.12, s: 0.013, col: "#dbd6cb" },
      { x: 0.35, z: 0.14, s: 0.016, col: "#d6d2c8" },
      { x: 0.38, z: 0.17, s: 0.011, col: "#e5e0d6" },
      { x: -0.14, z: 0.38, s: 0.013, col: "#dfd9ce" },
      { x: 0.04, z: 0.42, s: 0.012, col: "#d6d2c8" },
      { x: -0.20, z: 0.04, s: 0.013, col: "#e2ddd2" },
    ];

    return {
      tufts: tufts.filter((it) => keepX(it.x)),
      flowers: flowers.filter((it) => keepX(it.x)),
      mossPads: mossPads.filter((it) => keepX(it.x)),
      pebbles: pebbles.filter((it) => keepX(it.x)),
    };
  }, [side]);

  // 3. AUTUMN: Expansive swaying golden wheat/rice waves (~125 stalks) + warm autumn grass + shrubs + acorns
  const autumnData = useMemo(() => {
    const r = makeRng(3303);
    const zones = SEASON_ZONES.autumn;
    const stalkCols = ["#f5c851", "#ffd866", "#e8b343", "#ffcb57", "#f0ba48", "#f7b249"];
    const wheat: { x: number; z: number; h: number; ry: number; col: string; phase: number; isGrass: boolean }[] = [];

    // Stratified grid fills EVERY open autumn area with lush golden wheat waves & warm amber autumn grass!
    for (let gx = -0.60; gx <= 0.60; gx += 0.072) {
      for (let gz = -0.58; gz <= 0.58; gz += 0.072) {
        const x = gx + (r() - 0.5) * 0.054;
        const z = gz + (r() - 0.5) * 0.054;
        if (!isClear(x, z, zones, 0.625)) continue;
        if (r() < 0.15) continue;
        const isGrass = r() < 0.28; // mix of plump golden wheat stalks (72%) & warm autumn grass tufts (28%)
        wheat.push({
          x,
          z,
          h: isGrass ? 0.048 + r() * 0.024 : 0.066 + r() * 0.036,
          ry: r() * Math.PI * 2,
          col: stalkCols[Math.floor(r() * stalkCols.length)],
          phase: x * 7.5 + z * 5.0,
          isGrass,
        });
      }
    }

    const shrubs: { x: number; z: number; s: number; col: string }[] = [
      { x: -0.34, z: -0.18, s: 0.042, col: "#f2784b" },
      { x: -0.14, z: -0.24, s: 0.038, col: "#ffaa4c" },
      { x: 0.18, z: -0.24, s: 0.038, col: "#f06848" },
      { x: 0.42, z: -0.02, s: 0.034, col: "#ffc254" },
      { x: -0.44, z: 0.12, s: 0.036, col: "#f58a4c" },
      { x: 0.38, z: 0.14, s: 0.036, col: "#ff9e52" },
      { x: -0.08, z: 0.46, s: 0.032, col: "#f0724c" },
      { x: 0.10, z: 0.46, s: 0.032, col: "#ffae4c" },
      { x: -0.30, z: 0.28, s: 0.034, col: "#f27c4e" },
      { x: 0.42, z: 0.08, s: 0.030, col: "#f58f48" },
    ];

    const acorns: { x: number; z: number; ry: number }[] = [];
    for (let tries = 0; tries < 120 && acorns.length < 18; tries++) {
      const x = (r() - 0.5) * 0.96;
      const z = -0.16 + r() * 0.66;
      if (!isClear(x, z, zones, 0.59)) continue;
      acorns.push({ x, z, ry: r() * 6.28 });
    }

    return {
      wheat: wheat.filter((it) => keepX(it.x)),
      shrubs: shrubs.filter((it) => keepX(it.x)),
      acorns: acorns.filter((it) => keepX(it.x)),
    };
  }, [side]);

  // 4. WINTER: Rich rolling moonlit snowdrifts (20 mounds) + ~48 frost-tipped grass tufts + snow holly shrubs + footprints + ice crystals
  const winterData = useMemo(() => {
    const r = makeRng(4404);
    const zones = SEASON_ZONES.winter;

    const snowdrifts: { x: number; z: number; sx: number; sy: number; sz: number; col: string }[] = [
      { x: -0.14, z: 0.08, sx: 0.095, sy: 0.024, sz: 0.075, col: "#d8e6f7" },
      { x: 0.14, z: 0.05, sx: 0.09, sy: 0.022, sz: 0.07, col: "#ccddf2" },
      { x: -0.36, z: 0.15, sx: 0.085, sy: 0.026, sz: 0.068, col: "#d5e4f6" },
      { x: -0.14, z: 0.34, sx: 0.08, sy: 0.022, sz: 0.065, col: "#c8daf0" },
      { x: 0.36, z: -0.06, sx: 0.085, sy: 0.025, sz: 0.07, col: "#d8e6f7" },
      { x: 0.04, z: -0.22, sx: 0.10, sy: 0.028, sz: 0.075, col: "#cfdff4" },
      { x: -0.34, z: -0.10, sx: 0.085, sy: 0.024, sz: 0.068, col: "#c8daf0" },
      { x: 0.24, z: 0.30, sx: 0.075, sy: 0.020, sz: 0.06, col: "#d6e5f6" },
      { x: -0.06, z: 0.45, sx: 0.075, sy: 0.020, sz: 0.058, col: "#ccddf2" },
      { x: 0.38, z: 0.18, sx: 0.075, sy: 0.022, sz: 0.06, col: "#d8e6f7" },
      { x: -0.46, z: 0.04, sx: 0.08, sy: 0.022, sz: 0.062, col: "#d1e1f5" },
      { x: 0.45, z: 0.04, sx: 0.078, sy: 0.022, sz: 0.06, col: "#ccddf2" },
      { x: -0.26, z: 0.28, sx: 0.078, sy: 0.020, sz: 0.062, col: "#d6e5f6" },
      { x: 0.08, z: 0.46, sx: 0.072, sy: 0.019, sz: 0.056, col: "#d0e0f4" },
      { x: -0.20, z: -0.24, sx: 0.088, sy: 0.024, sz: 0.068, col: "#c9dbf1" },
      { x: 0.24, z: -0.24, sx: 0.085, sy: 0.024, sz: 0.066, col: "#d4e3f6" },
      { x: -0.40, z: -0.14, sx: 0.075, sy: 0.022, sz: 0.06, col: "#d0e0f4" },
      { x: 0.40, z: -0.14, sx: 0.075, sy: 0.022, sz: 0.06, col: "#ccddf2" },
    ];

    const frostGrass: { x: number; z: number; s: number; ry: number; phase: number }[] = [];
    for (let gx = -0.58; gx <= 0.58; gx += 0.115) {
      for (let gz = -0.56; gz <= 0.56; gz += 0.115) {
        const x = gx + (r() - 0.5) * 0.08;
        const z = gz + (r() - 0.5) * 0.08;
        if (!isClear(x, z, zones, 0.61)) continue;
        if (r() < 0.22) continue;
        frostGrass.push({
          x,
          z,
          s: 0.68 + r() * 0.48,
          ry: r() * 6.28,
          phase: x * 5 + z * 5,
        });
      }
    }

    const snowShrubs: { x: number; z: number; s: number }[] = [
      { x: -0.36, z: -0.08, s: 0.036 },
      { x: -0.14, z: 0.28, s: 0.032 },
      { x: 0.42, z: -0.04, s: 0.034 },
      { x: 0.16, z: -0.02, s: 0.030 },
      { x: -0.38, z: 0.15, s: 0.030 },
      { x: 0.22, z: 0.32, s: 0.028 },
      { x: -0.44, z: 0.08, s: 0.028 },
      { x: -0.10, z: 0.46, s: 0.028 },
      { x: 0.08, z: 0.46, s: 0.028 },
      { x: -0.28, z: -0.22, s: 0.032 },
    ];

    // Winding trail of snow footprints from front stepping stones toward snowman & cottage
    const footprints: { x: number; z: number; ry: number }[] = [
      { x: -0.06, z: 0.32, ry: -0.6 },
      { x: -0.09, z: 0.29, ry: -0.65 },
      { x: -0.12, z: 0.27, ry: -0.7 },
      { x: -0.15, z: 0.24, ry: -0.75 },
      { x: -0.18, z: 0.22, ry: -0.7 },
      { x: 0.06, z: 0.13, ry: 0.5 },
      { x: 0.09, z: 0.09, ry: 0.55 },
      { x: 0.12, z: 0.04, ry: 0.5 },
      { x: 0.15, z: -0.01, ry: 0.45 },
      { x: 0.17, z: -0.06, ry: 0.4 },
    ];

    const iceCrystals: { x: number; z: number; s: number; ry: number }[] = [
      { x: 0.11, z: 0.20, s: 0.016, ry: 0.4 },
      { x: 0.13, z: 0.14, s: 0.013, ry: 1.1 },
      { x: 0.36, z: 0.20, s: 0.015, ry: 2.0 },
      { x: 0.31, z: 0.26, s: 0.012, ry: 0.8 },
      { x: 0.18, z: 0.28, s: 0.014, ry: 1.7 },
      { x: 0.32, z: 0.12, s: 0.012, ry: 2.6 },
      { x: -0.04, z: 0.42, s: 0.013, ry: 0.9 },
      { x: 0.26, z: 0.36, s: 0.012, ry: 1.9 },
      { x: -0.30, z: 0.26, s: 0.013, ry: 2.3 },
      { x: 0.42, z: 0.12, s: 0.013, ry: 0.5 },
    ];

    return {
      snowdrifts: snowdrifts.filter((it) => keepX(it.x)),
      frostGrass: frostGrass.filter((it) => keepX(it.x)),
      snowShrubs: snowShrubs.filter((it) => keepX(it.x)),
      footprints: footprints.filter((it) => keepX(it.x)),
      iceCrystals: iceCrystals.filter((it) => keepX(it.x)),
    };
  }, [side]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const count =
      season === "spring"
        ? springData.tufts.length
        : season === "summer"
          ? summerData.tufts.length
          : season === "autumn"
            ? autumnData.wheat.length
            : winterData.frostGrass.length;

    const amp = season === "autumn" ? 0.16 : season === "winter" ? 0.05 : 0.10;
    const spd = season === "autumn" ? 2.1 : 1.7;

    for (let i = 0; i < count; i++) {
      const g = swayRefs.current[i];
      if (!g) continue;
      const ph =
        season === "spring"
          ? springData.tufts[i].phase
          : season === "summer"
            ? summerData.tufts[i].phase
            : season === "autumn"
              ? autumnData.wheat[i].phase
              : winterData.frostGrass[i].phase;
      g.rotation.z = Math.sin(t * spd + ph) * amp;
      g.rotation.x = Math.cos(t * spd * 0.8 + ph) * amp * 0.5;
    }
  });

  if (season === "spring") {
    return (
      <group>
        {splitMoundEl}
        {/* 46 swaying 3-blade tender spring grass tufts */}
        {springData.tufts.map((tuft, i) => (
          <group
            key={`sg-${i}`}
            ref={(el) => {
              swayRefs.current[i] = el;
            }}
            position={[tuft.x, 0.002, tuft.z]}
            rotation={[0, tuft.ry, 0]}
            scale={tuft.s}
          >
            <mesh geometry={GRASS_BLADE_GEO} rotation={[0.16, 0, -0.22]}>
              <BrightMat color={tuft.col} boost={0.38} />
            </mesh>
            <mesh geometry={GRASS_BLADE_GEO} rotation={[-0.14, 2.1, 0.2]} scale={[0.9, 0.85, 0.9]}>
              <BrightMat color={tuft.col} boost={0.38} />
            </mesh>
            <mesh geometry={GRASS_BLADE_GEO} rotation={[0.1, 4.2, 0.18]} scale={[0.85, 0.72, 0.85]}>
              <BrightMat color="#a6e88a" boost={0.40} />
            </mesh>
          </group>
        ))}

        {/* 16 fluffy white dandelion puffs */}
        {springData.dandelions.map((d, i) => (
          <group key={`dan-${i}`} position={[d.x, 0.002, d.z]}>
            <mesh position={[0, d.h / 2, 0]}>
              <cylinderGeometry args={[0.002, 0.0028, d.h, 5]} />
              <BrightMat color="#85cc78" boost={0.35} />
            </mesh>
            <mesh position={[0, d.h, 0]}>
              <sphereGeometry args={[0.011, 8, 8]} />
              <BrightMat color="#ffffff" boost={0.52} opacity={0.92} />
            </mesh>
          </group>
        ))}

        {/* 20 tiny pastel spring meadow flower buds tucked among the grass */}
        {springData.buds.map((b, i) => (
          <group key={`bud-${i}`} position={[b.x, 0.002, b.z]}>
            <mesh position={[0, b.h / 2, 0]}>
              <cylinderGeometry args={[0.0018, 0.0024, b.h, 5]} />
              <BrightMat color="#7bc972" boost={0.34} />
            </mesh>
            <mesh position={[0, b.h, 0]}>
              <sphereGeometry args={[0.0085, 7, 7]} />
              <BrightMat color={b.col} boost={0.46} />
            </mesh>
          </group>
        ))}

        {/* 26 scattered pink cherry blossom petals on the meadow */}
        {springData.petals.map((p, i) => (
          <mesh
            key={`pet-${i}`}
            position={[p.x, 0.005, p.z]}
            rotation={[0, p.ry, 0]}
            scale={[0.016 * p.s, 0.002, 0.011 * p.s]}
          >
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <BrightMat color={p.col} boost={0.46} />
          </mesh>
        ))}
      </group>
    );
  }

  if (season === "summer") {
    return (
      <group>
        {splitMoundEl}
        {/* 42 lush summer grass & fanned fern clusters */}
        {summerData.tufts.map((tuft, i) => (
          <group
            key={`sumg-${i}`}
            ref={(el) => {
              swayRefs.current[i] = el;
            }}
            position={[tuft.x, 0.002, tuft.z]}
            rotation={[0, tuft.ry, 0]}
            scale={tuft.s}
          >
            <mesh geometry={GRASS_BLADE_GEO} rotation={[0.2, 0, -0.26]}>
              <BrightMat color={tuft.col} boost={0.36} />
            </mesh>
            <mesh geometry={GRASS_BLADE_GEO} rotation={[-0.18, 1.9, 0.24]} scale={[0.95, 0.9, 0.95]}>
              <BrightMat color={tuft.col} boost={0.36} />
            </mesh>
            <mesh geometry={GRASS_BLADE_GEO} rotation={[0.16, 3.8, 0.22]} scale={[0.85, 0.78, 0.85]}>
              <BrightMat color="#7ed978" boost={0.38} />
            </mesh>
            {tuft.fern && (
              <mesh geometry={GRASS_BLADE_GEO} rotation={[-0.36, 5.1, -0.32]} scale={[1.2, 0.82, 1.1]}>
                <BrightMat color="#4db55e" boost={0.34} />
              </mesh>
            )}
          </group>
        ))}

        {/* 15 wild daisies & sky-blue summer blossoms */}
        {summerData.flowers.map((f, i) => (
          <group key={`sf-${i}`} position={[f.x, 0.002, f.z]}>
            <mesh position={[0, f.h / 2, 0]}>
              <cylinderGeometry args={[0.0022, 0.003, f.h, 5]} />
              <BrightMat color="#5cb864" boost={0.34} />
            </mesh>
            <mesh position={[0, f.h, 0]}>
              <sphereGeometry args={[0.010, 7, 7]} />
              <BrightMat color={f.col} boost={0.48} />
            </mesh>
            <mesh position={[0, f.h + 0.004, 0]}>
              <sphereGeometry args={[0.0045, 6, 6]} />
              <BrightMat color="#ffe266" boost={0.48} />
            </mesh>
          </group>
        ))}

        {/* Soft moss cushions & river pebbles */}
        {summerData.mossPads.map((m, i) => (
          <mesh key={`moss-${i}`} geometry={BLOB_GEO} position={[m.x, 0.004, m.z]} scale={[m.sx, 0.010, m.sz]}>
            <BrightMat color="#85d67c" boost={0.36} />
          </mesh>
        ))}
        {summerData.pebbles.map((pb, i) => (
          <mesh key={`peb-${i}`} geometry={BLOB_GEO} position={[pb.x, 0.006, pb.z]} scale={[pb.s * 1.2, pb.s * 0.55, pb.s]}>
            <BrightMat color={pb.col} boost={0.32} />
          </mesh>
        ))}
      </group>
    );
  }

  if (season === "autumn") {
    return (
      <group>
        {splitMoundEl}
        {/* Expansive swaying golden wheat / rice waves + warm autumn grass tufts */}
        {autumnData.wheat.map((w, i) => (
          <group
            key={`wh-${i}`}
            ref={(el) => {
              swayRefs.current[i] = el;
            }}
            position={[w.x, 0.002, w.z]}
            rotation={[0, w.ry, 0]}
          >
            {w.isGrass ? (
              <>
                <mesh geometry={GRASS_BLADE_GEO} rotation={[0.18, 0, -0.24]} scale={[0.9, 0.88, 0.9]}>
                  <BrightMat color="#e0b052" boost={0.36} />
                </mesh>
                <mesh geometry={GRASS_BLADE_GEO} rotation={[-0.16, 2.2, 0.22]} scale={[0.85, 0.78, 0.85]}>
                  <BrightMat color="#d49a48" boost={0.34} />
                </mesh>
                <mesh geometry={GRASS_BLADE_GEO} rotation={[0.12, 4.3, 0.2]} scale={[0.78, 0.68, 0.78]}>
                  <BrightMat color="#f0c45e" boost={0.38} />
                </mesh>
              </>
            ) : (
              <>
                {/* Slender golden stalk */}
                <mesh position={[0, w.h * 0.5, 0]}>
                  <cylinderGeometry args={[0.0018, 0.0026, w.h, 5]} />
                  <BrightMat color="#e0b24c" boost={0.38} />
                </mesh>
                {/* Drooping plump golden wheat ear at top */}
                <mesh position={[0.006, w.h * 0.96, 0]} rotation={[0, 0, -0.52]} scale={[0.0055, 0.016, 0.0055]}>
                  <sphereGeometry args={[1, 7, 7]} />
                  <BrightMat color={w.col} boost={0.44} />
                </mesh>
                {/* Tiny companion leaf blade */}
                <mesh geometry={GRASS_BLADE_GEO} position={[0, 0.008, 0]} rotation={[0.15, 1.2, 0.35]} scale={[0.7, 0.72, 0.7]}>
                  <BrightMat color="#e8b856" boost={0.36} />
                </mesh>
              </>
            )}
          </group>
        ))}

        {/* Low crimson & amber autumn berry shrubs */}
        {autumnData.shrubs.map((sh, i) => (
          <group key={`ash-${i}`} position={[sh.x, sh.s * 0.55, sh.z]}>
            <mesh geometry={BLOB_GEO} scale={[sh.s * 1.15, sh.s * 0.78, sh.s]}>
              <BrightMat color={sh.col} boost={0.38} />
            </mesh>
            <mesh geometry={BLOB_GEO} position={[sh.s * 0.65, -sh.s * 0.12, sh.s * 0.3]} scale={[sh.s * 0.72, sh.s * 0.58, sh.s * 0.68]}>
              <BrightMat color="#ffc65c" boost={0.40} />
            </mesh>
          </group>
        ))}

        {/* Scattered warm acorns & pinecones */}
        {autumnData.acorns.map((ac, i) => (
          <group key={`ac-${i}`} position={[ac.x, 0.009, ac.z]} rotation={[0.4, ac.ry, 0.5]}>
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
      </group>
    );
  }

  // WINTER: Billowing snowdrifts + frost-tipped grass + snow-capped holly shrubs + snow footprints + ice crystals
  return (
    <group>
      {splitMoundEl}
      {/* 10 soft sculpted billowing snowdrifts breaking up the flat snow floor */}
      {winterData.snowdrifts.map((sd, i) => (
        <mesh key={`sd-${i}`} geometry={BLOB_GEO} position={[sd.x, 0.005, sd.z]} scale={[sd.sx, sd.sy, sd.sz]}>
          <BrightMat color={sd.col} boost={0.14} />
        </mesh>
      ))}

      {/* 18 frost-tipped dry winter grass tufts */}
      {winterData.frostGrass.map((fg, i) => (
        <group
          key={`fg-${i}`}
          ref={(el) => {
            swayRefs.current[i] = el;
          }}
          position={[fg.x, 0.002, fg.z]}
          rotation={[0, fg.ry, 0]}
          scale={fg.s}
        >
          <mesh geometry={GRASS_BLADE_GEO} rotation={[0.15, 0, -0.22]}>
            <BrightMat color="#c8d8eb" boost={0.40} />
          </mesh>
          <mesh geometry={GRASS_BLADE_GEO} rotation={[-0.14, 2.2, 0.2]} scale={[0.85, 0.8, 0.85]}>
            <BrightMat color="#e4f0fc" boost={0.46} />
          </mesh>
        </group>
      ))}

      {/* 6 snow-capped low holly shrubs with red winter berries */}
      {winterData.snowShrubs.map((sh, i) => (
        <group key={`wsh-${i}`} position={[sh.x, sh.s * 0.5, sh.z]}>
          <mesh geometry={BLOB_GEO} scale={[sh.s * 1.1, sh.s * 0.72, sh.s]}>
            <BrightMat color="#6ca384" boost={0.34} />
          </mesh>
          <mesh geometry={BLOB_GEO} position={[0, sh.s * 0.42, 0]} scale={[sh.s * 0.95, sh.s * 0.45, sh.s * 0.88]}>
            <BrightMat color="#d8e8f8" boost={0.16} />
          </mesh>
          <mesh position={[sh.s * 0.55, sh.s * 0.15, sh.s * 0.55]}>
            <sphereGeometry args={[0.006, 6, 6]} />
            <BrightMat color="#f05a62" boost={0.44} />
          </mesh>
        </group>
      ))}

      {/* Winding trail of cute indented snow footprints */}
      {winterData.footprints.map((fp, i) => (
        <mesh
          key={`fp-${i}`}
          position={[fp.x, 0.004, fp.z]}
          rotation={[0, fp.ry, 0]}
          scale={[0.011, 0.002, 0.017]}
        >
          <cylinderGeometry args={[1, 1, 1, 8]} />
          <BrightMat color="#c7dff7" boost={0.40} />
        </mesh>
      ))}

      {/* Sparkling pale-blue ice crystals beside the frozen pond */}
      {winterData.iceCrystals.map((ic, i) => (
        <mesh
          key={`ic-${i}`}
          position={[ic.x, ic.s * 0.7, ic.z]}
          rotation={[0.15, ic.ry, 0.2]}
          scale={[ic.s * 0.65, ic.s * 1.4, ic.s * 0.65]}
        >
          <octahedronGeometry args={[1, 0]} />
          <BrightMat color="#cceeff" boost={0.56} opacity={0.88} />
        </mesh>
      ))}
    </group>
  );
}
