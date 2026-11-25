"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Season } from "./SeasonTree3D";
import { H, L } from "@/lib/fold";
import { book } from "@/lib/store";

const BLOB_GEO = new THREE.IcosahedronGeometry(1, 1);

const ClipPlanesCtx = createContext<THREE.Plane[] | null>(null);

function SoftMat({ color, boost = 0.34, opacity = 1 }: { color: string; boost?: number; opacity?: number }) {
  const clipPlanes = useContext(ClipPlanesCtx);
  return (
    <meshLambertMaterial
      color={color}
      emissive={color}
      emissiveIntensity={boost}
      transparent={opacity < 1}
      opacity={opacity}
      clippingPlanes={clipPlanes}
    />
  );
}

type RidgeConfig = {
  ridgeFn: (u: number) => number;
  maxDepth: number;
  alpine: boolean;
  phase: number;
};

type MountainParams = { height: number; width: number; length: number };

const DEFAULT_MOUNTAIN: MountainParams = { height: 0.48, width: 1.74, length: 1.4 };

/** Exact surface evaluator matching createSlopedMountainGeo so every prop sits solidly on the 3D slope */
function evalSlopePoint(
  cfg: RidgeConfig,
  u: number,
  v: number,
  params: MountainParams = DEFAULT_MOUNTAIN,
): [number, number, number] {
  const halfSpan = Math.min(0.494, 0.494 * params.length);
  const x = (0.5 + (u - 0.5) * 2 * halfSpan) * L;
  // When length > 1, broaden the ridge profile toward the corners while staying cleanly inside the book page
  const uSample = params.length > 1 ? Math.max(0, Math.min(1, 0.5 + (u - 0.5) / params.length)) : u;

  const taperWidth = params.length > 1 ? 0.09 / params.length : 0.09;
  const edgeTaper = Math.min(1, Math.min(u, 1 - u) / taperWidth);
  const smoothEdge = edgeTaper * edgeTaper * (3 - 2 * edgeTaper);

  const baseRidge = cfg.ridgeFn(uSample) * H * smoothEdge * params.height;
  // Broad, plump dome-like mountain slope (cos falloff stays wide and generous before gliding smoothly to y = 0)
  const slopeFalloff = Math.pow(Math.cos(v * Math.PI * 0.5), cfg.alpine ? 1.12 : 1.05);
  const ripple =
    Math.sin(uSample * 17.0 + v * 4.5 + cfg.phase) *
    Math.cos(uSample * 10.0 - v * 3.5 + cfg.phase) *
    (cfg.alpine ? 0.018 : 0.011) *
    params.height *
    Math.sin(v * Math.PI) *
    smoothEdge;

  const y = Math.max(0, baseRidge * slopeFalloff + ripple);
  const localDepth =
    cfg.maxDepth *
    params.width *
    (0.82 + 0.18 * Math.sin(uSample * Math.PI * 2.2 + cfg.phase)) *
    (0.48 + 0.52 * smoothEdge);
  const z = 0.002 + v * localDepth;
  return [x, y, z];
}

/** Evaluate height of a given ridge layer at an arbitrary (u, z) so overlapping layers never bury props */
function evalHeightAtUZ(
  cfg: RidgeConfig,
  u: number,
  z: number,
  params: MountainParams = DEFAULT_MOUNTAIN,
): number {
  const uSample = params.length > 1 ? Math.max(0, Math.min(1, 0.5 + (u - 0.5) / params.length)) : u;
  const taperWidth = params.length > 1 ? 0.09 / params.length : 0.09;
  const edgeTaper = Math.min(1, Math.min(u, 1 - u) / taperWidth);
  const smoothEdge = edgeTaper * edgeTaper * (3 - 2 * edgeTaper);
  const localDepth =
    cfg.maxDepth *
    params.width *
    (0.82 + 0.18 * Math.sin(uSample * Math.PI * 2.2 + cfg.phase)) *
    (0.48 + 0.52 * smoothEdge);
  const v = (z - 0.002) / Math.max(0.001, localDepth);
  if (v < 0 || v >= 1) return 0;
  return evalSlopePoint(cfg, u, v, params)[1];
}

const MOUNTAIN_NX = 24;
const MOUNTAIN_NZ = 9;

/** Update an existing mountain BufferGeometry's vertices in-place when live slider params change */
function updateSlopedMountainPositions(
  geo: THREE.BufferGeometry,
  cfg: RidgeConfig,
  params: MountainParams,
) {
  const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
  let idx = 0;
  for (let iz = 0; iz <= MOUNTAIN_NZ; iz++) {
    const v = iz / MOUNTAIN_NZ;
    for (let ix = 0; ix <= MOUNTAIN_NX; ix++) {
      const u = ix / MOUNTAIN_NX;
      const [x, y, z] = evalSlopePoint(cfg, u, v, params);
      posAttr.setXYZ(idx++, x, y, z);
    }
  }
  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * True complete 3D low-poly sloped mountain/hill range!
 * Rises along the back wall (z = 0.002) and slopes organically & smoothly down to y = 0
 * into the interior floor (z = maxDepth) with soft vertex-color height gradient — ZERO flat cut slabs!
 */
function createSlopedMountainGeo(
  cfg: RidgeConfig,
  colLow: string,
  colMid: string,
  colPeak: string,
  peakNormH = 0.42,
): THREE.BufferGeometry {
  const nx = MOUNTAIN_NX;
  const nz = MOUNTAIN_NZ;

  const cLow = new THREE.Color(colLow);
  const cMid = new THREE.Color(colMid);
  const cPeak = new THREE.Color(colPeak);
  const tmp = new THREE.Color();

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= nz; iz++) {
    const v = iz / nz;
    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx;
      const [x, y, z] = evalSlopePoint(cfg, u, v);
      positions.push(x, y, z);

      const hNorm = Math.min(1, y / (peakNormH * H));
      if (hNorm < 0.5) {
        tmp.copy(cLow).lerp(cMid, hNorm / 0.5);
      } else {
        tmp.copy(cMid).lerp(cPeak, (hNorm - 0.5) / 0.5);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  const stride = nx + 1;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * stride + ix;
      const b = a + 1;
      const c = (iz + 1) * stride + ix;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Rich 2-layer ridge profiles (back tall range + plump foreground foothills) ----------
// Right wall dips gracefully around u > 0.57 so the wooden season signpost (x = 0.76) stays 100% clear!
const rightSignpostMask = (u: number) => (u > 0.56 ? Math.max(0.20, 1 - (u - 0.56) * 2.15) : 1);

const leftBackRolling: RidgeConfig = {
  ridgeFn: (u) => 0.32 + 0.16 * Math.sin(u * Math.PI * 1.15) + 0.07 * Math.sin(u * Math.PI * 3.1 + 0.35),
  maxDepth: 0.16,
  alpine: false,
  phase: 0.6,
};
const leftFrontRolling: RidgeConfig = {
  ridgeFn: (u) => 0.19 + 0.10 * Math.sin(u * Math.PI * 1.4 + 0.5) + 0.045 * Math.sin(u * Math.PI * 3.4 - 0.5),
  maxDepth: 0.21,
  alpine: false,
  phase: 2.1,
};

const rightBackRolling: RidgeConfig = {
  ridgeFn: (u) =>
    (0.32 + 0.14 * Math.sin(u * Math.PI * 1.1 + 0.25) + 0.06 * Math.sin(u * Math.PI * 2.9)) * rightSignpostMask(u),
  maxDepth: 0.14,
  alpine: false,
  phase: 0.9,
};
const rightFrontRolling: RidgeConfig = {
  ridgeFn: (u) =>
    (0.18 + 0.09 * Math.sin(u * Math.PI * 1.3 + 0.4) + 0.04 * Math.sin(u * Math.PI * 3.2 + 0.8)) *
    (u > 0.54 ? Math.max(0.18, 1 - (u - 0.54) * 2.1) : 1),
  maxDepth: 0.18,
  alpine: false,
  phase: 2.5,
};

const leftBackWinter: RidgeConfig = {
  ridgeFn: (u) => {
    const p1 = Math.max(0, 1 - Math.abs(u - 0.20) / 0.22) * 0.54;
    const p2 = Math.max(0, 1 - Math.abs(u - 0.48) / 0.24) * 0.50;
    const p3 = Math.max(0, 1 - Math.abs(u - 0.78) / 0.24) * 0.46;
    return Math.max(0.20, p1, p2, p3);
  },
  maxDepth: 0.16,
  alpine: true,
  phase: 0.4,
};
const leftFrontWinter: RidgeConfig = {
  ridgeFn: (u) => {
    const p1 = Math.max(0, 1 - Math.abs(u - 0.30) / 0.26) * 0.30;
    const p2 = Math.max(0, 1 - Math.abs(u - 0.65) / 0.26) * 0.28;
    return Math.max(0.14, p1, p2) + 0.03 * Math.sin(u * Math.PI * 3.0);
  },
  maxDepth: 0.21,
  alpine: false,
  phase: 1.9,
};

const rightBackWinter: RidgeConfig = {
  ridgeFn: (u) => {
    const p1 = Math.max(0, 1 - Math.abs(u - 0.24) / 0.24) * 0.52;
    const p2 = Math.max(0, 1 - Math.abs(u - 0.50) / 0.22) * 0.44;
    const raw = Math.max(0.16, p1, p2);
    return u > 0.56 ? raw * Math.max(0.24, 1 - (u - 0.56) * 1.95) : raw;
  },
  maxDepth: 0.14,
  alpine: true,
  phase: 0.7,
};
const rightFrontWinter: RidgeConfig = {
  ridgeFn: (u) => {
    const p1 = Math.max(0, 1 - Math.abs(u - 0.36) / 0.28) * 0.28;
    const raw = Math.max(0.12, p1);
    return u > 0.54 ? raw * Math.max(0.22, 1 - (u - 0.54) * 2.0) : raw;
  },
  maxDepth: 0.18,
  alpine: false,
  phase: 2.3,
};

const RIDGE_CFGS: Record<Season, { left: { back: RidgeConfig; front: RidgeConfig }; right: { back: RidgeConfig; front: RidgeConfig } }> = {
  spring: {
    left: { back: leftBackRolling, front: leftFrontRolling },
    right: { back: rightBackRolling, front: rightFrontRolling },
  },
  summer: {
    left: { back: leftBackRolling, front: leftFrontRolling },
    right: { back: rightBackRolling, front: rightFrontRolling },
  },
  autumn: {
    left: { back: leftBackRolling, front: leftFrontRolling },
    right: { back: rightBackRolling, front: rightFrontRolling },
  },
  winter: {
    left: { back: leftBackWinter, front: leftFrontWinter },
    right: { back: rightBackWinter, front: rightFrontWinter },
  },
};

const SLOPED_MOUNTAIN_GEOS: Record<
  Season,
  {
    left: { back: THREE.BufferGeometry; front: THREE.BufferGeometry };
    right: { back: THREE.BufferGeometry; front: THREE.BufferGeometry };
  }
> = {
  spring: {
    left: {
      back: createSlopedMountainGeo(leftBackRolling, "#8ed180", "#b2e49f", "#d7f5be", 0.44),
      front: createSlopedMountainGeo(leftFrontRolling, "#a9e08e", "#c8f0aa", "#e4fac8", 0.28),
    },
    right: {
      back: createSlopedMountainGeo(rightBackRolling, "#8ed180", "#b2e49f", "#d7f5be", 0.42),
      front: createSlopedMountainGeo(rightFrontRolling, "#a9e08e", "#c8f0aa", "#e4fac8", 0.26),
    },
  },
  summer: {
    left: {
      back: createSlopedMountainGeo(leftBackRolling, "#5db868", "#7ed47e", "#a8ea96", 0.44),
      front: createSlopedMountainGeo(leftFrontRolling, "#78cf76", "#9be38c", "#c3f2a4", 0.28),
    },
    right: {
      back: createSlopedMountainGeo(rightBackRolling, "#5db868", "#7ed47e", "#a8ea96", 0.42),
      front: createSlopedMountainGeo(rightFrontRolling, "#78cf76", "#9be38c", "#c3f2a4", 0.26),
    },
  },
  autumn: {
    left: {
      back: createSlopedMountainGeo(leftBackRolling, "#d68d54", "#eaad6e", "#f9cf91", 0.44),
      front: createSlopedMountainGeo(leftFrontRolling, "#e6a464", "#f5c27e", "#ffe0a4", 0.28),
    },
    right: {
      back: createSlopedMountainGeo(rightBackRolling, "#d68d54", "#eaad6e", "#f9cf91", 0.42),
      front: createSlopedMountainGeo(rightFrontRolling, "#e6a464", "#f5c27e", "#ffe0a4", 0.26),
    },
  },
  winter: {
    left: {
      back: createSlopedMountainGeo(leftBackWinter, "#7a9ad1", "#a9c5ed", "#e4f0ff", 0.48),
      front: createSlopedMountainGeo(leftFrontWinter, "#9db8e6", "#c6daf7", "#edf5ff", 0.28),
    },
    right: {
      back: createSlopedMountainGeo(rightBackWinter, "#7a9ad1", "#a9c5ed", "#e4f0ff", 0.46),
      front: createSlopedMountainGeo(rightFrontWinter, "#9db8e6", "#c6daf7", "#edf5ff", 0.26),
    },
  },
};

/** Helper to compute exact [x, y, z] planted on the TOP-MOST visible surface of back+front mountain slopes */
function onSlope(
  cfgs: { back: RidgeConfig; front: RidgeConfig },
  layer: "back" | "front",
  u: number,
  v: number,
  sink = 0.005,
  params: MountainParams = DEFAULT_MOUNTAIN,
): [number, number, number] {
  const primary = cfgs[layer];
  const other = layer === "back" ? cfgs.front : cfgs.back;
  const [x, y1, z] = evalSlopePoint(primary, u, v, params);
  const y2 = evalHeightAtUZ(other, u, z, params);
  const yTop = Math.max(y1, y2);
  return [x, Math.max(0.002, yTop - sink), z];
}

/** Auto-tracking 3D anchor that keeps hillside props glued to the live-resizable 3D slope surface at 60 FPS */
function SlopeAnchor({
  cfgs,
  layer,
  u,
  v,
  sink = 0.005,
  children,
}: {
  cfgs: { back: RidgeConfig; front: RidgeConfig };
  layer: "back" | "front";
  u: number;
  v: number;
  sink?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const last = useRef({ h: -1, w: -1, l: -1 });
  const initialPos = useMemo(
    () => onSlope(cfgs, layer, u, v, sink, book.mountain),
    [cfgs, layer, u, v, sink],
  );

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const m = book.mountain;
    if (last.current.h === m.height && last.current.w === m.width && last.current.l === m.length) return;
    last.current.h = m.height;
    last.current.w = m.width;
    last.current.l = m.length;
    const [x, y, z] = onSlope(cfgs, layer, u, v, sink, m);
    g.position.set(x, y, z);
  });

  return (
    <group ref={ref} position={initialPos}>
      {children}
    </group>
  );
}

/** Full volumetric 6-puff sculpted 3D cloud floating out into the room airspace toward the tree */
function SoftCloud3D({
  x,
  y,
  z = 0.095,
  sc = 1,
  col = "#ffffff",
  boost = 0.44,
}: {
  x: number;
  y: number;
  z?: number;
  sc?: number;
  col?: string;
  boost?: number;
}) {
  return (
    <group position={[x * L, y * H, z]} scale={[sc, sc, sc * 0.88]}>
      {[
        [0, 0.010, 0.004, 0.060, 0.038, 0.044],
        [-0.048, -0.004, 0.002, 0.043, 0.030, 0.038],
        [0.050, -0.002, 0.002, 0.045, 0.031, 0.038],
        [-0.022, 0.022, 0.000, 0.036, 0.028, 0.034],
        [0.026, 0.018, -0.001, 0.035, 0.026, 0.034],
        [0.002, -0.008, 0.012, 0.044, 0.024, 0.032],
      ].map(([px, py, pz, sx, sy, sz], i) => (
        <mesh key={i} geometry={BLOB_GEO} position={[px, py, pz]} scale={[sx, sy, sz]}>
          <SoftMat color={col} boost={boost} />
        </mesh>
      ))}
    </group>
  );
}

/** Full volumetric multi-puff miniature storybook tree planted on the 3D mountain slope */
function MiniClusterTree3D({
  pos,
  sc = 1,
  col1,
  col2,
  trunkCol = "#b88960",
}: {
  pos: [number, number, number];
  sc?: number;
  col1: string;
  col2: string;
  trunkCol?: string;
}) {
  return (
    <group position={pos} scale={sc}>
      <mesh position={[0, 0.022, 0]}>
        <cylinderGeometry args={[0.006, 0.010, 0.046, 6]} />
        <SoftMat color={trunkCol} boost={0.26} />
      </mesh>
      <mesh geometry={BLOB_GEO} position={[0, 0.060, 0]} scale={[0.035, 0.031, 0.033]}>
        <SoftMat color={col1} boost={0.36} />
      </mesh>
      <mesh geometry={BLOB_GEO} position={[-0.022, 0.048, 0.007]} scale={[0.025, 0.022, 0.024]}>
        <SoftMat color={col2} boost={0.38} />
      </mesh>
      <mesh geometry={BLOB_GEO} position={[0.023, 0.050, 0.006]} scale={[0.024, 0.023, 0.024]}>
        <SoftMat color={col1} boost={0.36} />
      </mesh>
      <mesh geometry={BLOB_GEO} position={[0.004, 0.078, -0.002]} scale={[0.022, 0.020, 0.022]}>
        <SoftMat color={col2} boost={0.40} />
      </mesh>
    </group>
  );
}

/** Cute plump 3-puff hillside bush with optional tiny flower dots */
function MiniBush3D({
  pos,
  sc = 1,
  col1,
  col2,
  flowerCol,
}: {
  pos: [number, number, number];
  sc?: number;
  col1: string;
  col2: string;
  flowerCol?: string;
}) {
  return (
    <group position={pos} scale={sc}>
      <mesh geometry={BLOB_GEO} position={[0, 0.014, 0]} scale={[0.026, 0.020, 0.024]}>
        <SoftMat color={col1} boost={0.34} />
      </mesh>
      <mesh geometry={BLOB_GEO} position={[-0.018, 0.010, 0.005]} scale={[0.019, 0.015, 0.018]}>
        <SoftMat color={col2} boost={0.36} />
      </mesh>
      <mesh geometry={BLOB_GEO} position={[0.018, 0.011, 0.004]} scale={[0.018, 0.016, 0.018]}>
        <SoftMat color={col1} boost={0.34} />
      </mesh>
      {flowerCol && (
        <>
          <mesh position={[-0.008, 0.027, 0.014]}>
            <octahedronGeometry args={[0.005, 0]} />
            <SoftMat color={flowerCol} boost={0.48} />
          </mesh>
          <mesh position={[0.010, 0.022, 0.016]}>
            <octahedronGeometry args={[0.0045, 0]} />
            <SoftMat color={flowerCol} boost={0.48} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Full volumetric 3-tier snow-capped 3D pine tree planted on the snowy mountain slope */
function TieredPine3D({ pos, sc = 1 }: { pos: [number, number, number]; sc?: number }) {
  return (
    <group position={pos} scale={sc}>
      <mesh position={[0, 0.016, 0]}>
        <cylinderGeometry args={[0.005, 0.008, 0.034, 6]} />
        <SoftMat color="#7d5c4c" boost={0.22} />
      </mesh>
      <mesh position={[0, 0.044, 0]}>
        <coneGeometry args={[0.036, 0.044, 7]} />
        <SoftMat color="#4f7494" boost={0.22} />
      </mesh>
      <mesh position={[0, 0.068, 0]}>
        <coneGeometry args={[0.028, 0.040, 7]} />
        <SoftMat color="#5c84a6" boost={0.24} />
      </mesh>
      <mesh position={[0, 0.090, 0]}>
        <coneGeometry args={[0.020, 0.034, 7]} />
        <SoftMat color="#dce9f8" boost={0.18} />
      </mesh>
    </group>
  );
}

/** Cozy miniature storybook hillside cottage / alpine chalet with glowing window */
function MiniCottage3D({
  pos,
  sc = 1,
  rotY = 0.25,
  wallCol = "#fff3e0",
  roofCol = "#eb8a78",
  windowCol = "#ffe896",
  snowRoof = false,
}: {
  pos: [number, number, number];
  sc?: number;
  rotY?: number;
  wallCol?: string;
  roofCol?: string;
  windowCol?: string;
  snowRoof?: boolean;
}) {
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={sc}>
      {/* Main cottage body */}
      <mesh position={[0, 0.022, 0]}>
        <boxGeometry args={[0.056, 0.044, 0.046]} />
        <SoftMat color={wallCol} boost={0.30} />
      </mesh>
      {/* Pitched 4-sided storybook roof */}
      <mesh position={[0, 0.058, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.048, 0.036, 4]} />
        <SoftMat color={roofCol} boost={snowRoof ? 0.16 : 0.34} />
      </mesh>
      {/* Cute chimney */}
      <mesh position={[0.016, 0.064, -0.008]}>
        <boxGeometry args={[0.011, 0.024, 0.011]} />
        <SoftMat color="#b58672" boost={0.26} />
      </mesh>
      {/* Warm glowing doorway / window */}
      <mesh position={[-0.010, 0.022, 0.024]}>
        <boxGeometry args={[0.014, 0.014, 0.003]} />
        <meshBasicMaterial color={windowCol} />
      </mesh>
      <mesh position={[0.013, 0.015, 0.024]}>
        <boxGeometry args={[0.012, 0.022, 0.003]} />
        <SoftMat color="#a67252" boost={0.28} />
      </mesh>
    </group>
  );
}

/** Cute miniature wooden hillside pasture fence */
function MiniFence3D({
  pos,
  rotY = 0,
  col = "#fff7eb",
}: {
  pos: [number, number, number];
  rotY?: number;
  col?: string;
}) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {[-0.036, 0, 0.036].map((px, i) => (
        <mesh key={i} position={[px, 0.014, 0]}>
          <boxGeometry args={[0.006, 0.028, 0.006]} />
          <SoftMat color={col} boost={0.36} />
        </mesh>
      ))}
      <mesh position={[0, 0.020, 0]}>
        <boxGeometry args={[0.082, 0.005, 0.004]} />
        <SoftMat color={col} boost={0.36} />
      </mesh>
      <mesh position={[0, 0.010, 0]}>
        <boxGeometry args={[0.082, 0.005, 0.004]} />
        <SoftMat color={col} boost={0.36} />
      </mesh>
    </group>
  );
}

/** Tiny gliding 3D swallow for Spring sky */
function MiniSwallow3D({ x, y, z, sc = 1 }: { x: number; y: number; z: number; sc?: number }) {
  return (
    <group position={[x * L, y * H, z]} scale={sc}>
      <mesh position={[-0.012, 0.004, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.024, 0.0035, 0.008]} />
        <SoftMat color="#fff8fb" boost={0.46} />
      </mesh>
      <mesh position={[0.012, 0.004, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.024, 0.0035, 0.008]} />
        <SoftMat color="#fff8fb" boost={0.46} />
      </mesh>
    </group>
  );
}

export default function SeasonWall3D({
  season,
  wall,
  clipPlanes = null,
}: {
  season: Season;
  wall: "left" | "right";
  clipPlanes?: THREE.Plane[] | null;
}) {
  const balloonRef = useRef<THREE.Group>(null);
  const balloon2Ref = useRef<THREE.Group>(null);
  const windmillBladesRef = useRef<THREE.Group>(null);
  const swallowsRef = useRef<THREE.Group>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lastMountain = useRef({
    h: DEFAULT_MOUNTAIN.height,
    w: DEFAULT_MOUNTAIN.width,
    l: DEFAULT_MOUNTAIN.length,
  });

  const cfgs = RIDGE_CFGS[season][wall];
  const geos = useMemo(() => {
    const src = SLOPED_MOUNTAIN_GEOS[season][wall];
    const back = src.back.clone();
    const front = src.front.clone();
    if (
      book.mountain.height !== DEFAULT_MOUNTAIN.height ||
      book.mountain.width !== DEFAULT_MOUNTAIN.width ||
      book.mountain.length !== DEFAULT_MOUNTAIN.length
    ) {
      updateSlopedMountainPositions(back, cfgs.back, book.mountain);
      updateSlopedMountainPositions(front, cfgs.front, book.mountain);
    }
    return { back, front };
  }, [season, wall, cfgs]);

  useEffect(() => {
    return () => {
      geos.back.dispose();
      geos.front.dispose();
    };
  }, [geos]);

  const palette = useMemo(() => {
    switch (season) {
      case "spring":
        return { emissive: "#7ec774", frontEmissive: "#94d97e", boost: 0.18 };
      case "summer":
        return { emissive: "#5ab862", frontEmissive: "#6ec96e", boost: 0.16 };
      case "autumn":
        return { emissive: "#cf8f52", frontEmissive: "#de9f5e", boost: 0.18 };
      case "winter":
        return { emissive: "#7c9ad1", frontEmissive: "#94b0e0", boost: 0.12 };
    }
  }, [season]);

  useFrame(({ clock }) => {
    const m = book.mountain;
    if (lastMountain.current.h !== m.height || lastMountain.current.w !== m.width || lastMountain.current.l !== m.length) {
      lastMountain.current.h = m.height;
      lastMountain.current.w = m.width;
      lastMountain.current.l = m.length;
      updateSlopedMountainPositions(geos.back, cfgs.back, m);
      updateSlopedMountainPositions(geos.front, cfgs.front, m);
    }

    const t = clock.elapsedTime;
    if (balloonRef.current) {
      balloonRef.current.position.y = 0.72 * H + Math.sin(t * 1.1) * 0.022;
      balloonRef.current.rotation.z = Math.sin(t * 0.75) * 0.05;
    }
    if (balloon2Ref.current) {
      balloon2Ref.current.position.y = 0.64 * H + Math.sin(t * 0.95 + 1.4) * 0.016;
      balloon2Ref.current.rotation.z = Math.sin(t * 0.65 + 1.0) * 0.04;
    }
    if (windmillBladesRef.current) {
      windmillBladesRef.current.rotation.z = -t * 1.35;
    }
    if (swallowsRef.current) {
      swallowsRef.current.position.y = Math.sin(t * 1.6) * 0.014;
      swallowsRef.current.position.x = Math.sin(t * 0.55) * 0.018;
    }
    for (let i = 0; i < 9; i++) {
      const st = starRefs.current[i];
      if (!st) continue;
      st.scale.setScalar(0.80 + 0.34 * Math.sin(t * 2.4 + i * 1.15));
    }
  });

  return (
    <ClipPlanesCtx.Provider value={clipPlanes}>
    <group>
      {/* 1. Back tall complete 3D sloped mountain range */}
      <mesh geometry={geos.back}>
        <meshLambertMaterial
          vertexColors
          emissive={palette.emissive}
          emissiveIntensity={palette.boost}
          flatShading
          clippingPlanes={clipPlanes}
        />
      </mesh>
      {/* 2. Foreground plump complete 3D sloped foothill extending deeper toward the central tree */}
      <mesh geometry={geos.front}>
        <meshLambertMaterial
          vertexColors
          emissive={palette.frontEmissive}
          emissiveIntensity={palette.boost}
          flatShading
          clippingPlanes={clipPlanes}
        />
      </mesh>

      {/* ==================== SPRING 3D WALL DETAILS ==================== */}
      {season === "spring" &&
        (wall === "left" ? (
          <>
            {/* Fuller 4-band 3D pastel rainbow */}
            <group position={[0.29 * L, 0.48 * H, 0.075]} scale={[1.02, 1.02, 0.85]}>
              {[
                { r: 0.285, col: "#ffbad6" },
                { r: 0.262, col: "#ffdca8" },
                { r: 0.239, col: "#d2f5b8" },
                { r: 0.216, col: "#b6e2ff" },
              ].map((b, i) => (
                <mesh key={i}>
                  <torusGeometry args={[b.r, 0.012, 8, 30, Math.PI]} />
                  <SoftMat color={b.col} boost={0.44} opacity={0.84} />
                </mesh>
              ))}
            </group>
            <SoftCloud3D x={0.20} y={0.84} z={0.14} sc={1.06} col="#ffffff" />
            <SoftCloud3D x={0.44} y={0.76} z={0.11} sc={0.74} col="#fff8fb" />
            <SoftCloud3D x={0.66} y={0.86} z={0.12} sc={0.84} col="#fff8fb" />
            <group ref={swallowsRef}>
              <MiniSwallow3D x={0.34} y={0.74} z={0.16} sc={0.98} />
              <MiniSwallow3D x={0.40} y={0.70} z={0.15} sc={0.78} />
            </group>
            {/* Cozy pastel fairy cottage tucked on the wide spring hillside */}
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.22} v={0.44} sink={0.004}>
              <MiniCottage3D pos={[0, 0, 0]} sc={1.02} rotY={0.28} wallCol="#fff8f0" roofCol="#ff9eb8" windowCol="#fff0a6" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.31} v={0.62} sink={0.004}>
              <MiniFence3D pos={[0, 0, 0]} rotY={-0.18} col="#fff8f2" />
            </SlopeAnchor>
            {/* Lush multi-depth sakura & pastel-lime grove */}
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.12} v={0.36}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.98} col1="#ffb4d2" col2="#ffd4e6" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.14} v={0.60}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.90} col1="#9ce088" col2="#c2f2a2" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.30} v={0.32}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.88} col1="#ffc0da" col2="#ffe0ee" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.37} v={0.48}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.86} col1="#92db82" col2="#baf09c" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.45} v={0.62}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.78} col1="#ffb8d4" col2="#ffd8e8" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.56} v={0.34}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.80} col1="#a2e38c" col2="#c6f5a8" />
            </SlopeAnchor>
            {/* Blossom-dotted bushes along the lower foothills */}
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.10} v={0.76} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={1.02} col1="#96dc84" col2="#b8ef9c" flowerCol="#ffb8d4" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.25} v={0.72} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.94} col1="#9ee088" col2="#c2f2a4" flowerCol="#ffe88c" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.41} v={0.75} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.90} col1="#92d980" col2="#b6ec9a" flowerCol="#ffc4dc" />
            </SlopeAnchor>
          </>
        ) : (
          <>
            <SoftCloud3D x={0.42} y={0.85} z={0.12} sc={0.88} col="#ffffff" />
            <SoftCloud3D x={0.78} y={0.80} z={0.14} sc={1.06} col="#fff8fb" />
            <SoftCloud3D x={0.62} y={0.72} z={0.11} sc={0.70} col="#ffffff" />
            {/* Right-wall grove & bushes (leaving signpost x ∈ [0.68, 0.84] 100% clear!) */}
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.46} v={0.34}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.90} col1="#ffb8d4" col2="#ffd4e6" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.54} v={0.48}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.92} col1="#9ce088" col2="#c0f0a0" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.61} v={0.64}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.80} col1="#ffc4dc" col2="#ffe0ee" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.90} v={0.48}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.86} col1="#a4e08c" col2="#c6f2a6" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.56} v={0.74} sink={0.004}>
              <MiniFence3D pos={[0, 0, 0]} rotY={0.16} col="#fff8f2" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.48} v={0.72} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.96} col1="#96dc84" col2="#b8ef9c" flowerCol="#ffb8d4" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.88} v={0.70} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.90} col1="#9ee088" col2="#c2f2a4" flowerCol="#ffe88c" />
            </SlopeAnchor>
          </>
        ))}

      {/* ==================== SUMMER 3D WALL DETAILS ==================== */}
      {season === "summer" &&
        (wall === "left" ? (
          <>
            <SoftCloud3D x={0.17} y={0.85} z={0.14} sc={1.06} col="#ffffff" />
            <SoftCloud3D x={0.44} y={0.80} z={0.11} sc={0.78} col="#ffffff" />
            <SoftCloud3D x={0.65} y={0.86} z={0.12} sc={0.86} col="#ffffff" />
            {/* Main Volumetric 3D Striped Pastel Hot-Air Balloon */}
            <group ref={balloonRef} position={[0.23 * L, 0.72 * H, 0.155]}>
              <mesh scale={[0.048, 0.056, 0.048]}>
                <sphereGeometry args={[1, 14, 12]} />
                <SoftMat color="#ff96ae" boost={0.40} />
              </mesh>
              <mesh position={[0, 0, 0.006]} scale={[0.024, 0.055, 0.047]}>
                <sphereGeometry args={[1, 12, 10]} />
                <SoftMat color="#ffe68c" boost={0.44} />
              </mesh>
              <mesh position={[0, -0.050, 0]}>
                <cylinderGeometry args={[0.015, 0.010, 0.012, 8]} />
                <SoftMat color="#ffe68c" boost={0.38} />
              </mesh>
              {[-0.010, 0.010].map((rx, i) => (
                <mesh key={i} position={[rx, -0.062, 0]}>
                  <cylinderGeometry args={[0.0012, 0.0012, 0.018, 4]} />
                  <SoftMat color="#9e7a5e" boost={0.25} />
                </mesh>
              ))}
              <mesh position={[0, -0.076, 0]}>
                <boxGeometry args={[0.025, 0.018, 0.023]} />
                <SoftMat color="#d9a672" boost={0.34} />
              </mesh>
            </group>
            {/* Smaller distant second pastel-sky hot-air balloon */}
            <group ref={balloon2Ref} position={[0.36 * L, 0.65 * H, 0.12]} scale={0.70}>
              <mesh scale={[0.045, 0.053, 0.045]}>
                <sphereGeometry args={[1, 12, 10]} />
                <SoftMat color="#8ad4ff" boost={0.42} />
              </mesh>
              <mesh position={[0, 0, 0.005]} scale={[0.022, 0.052, 0.044]}>
                <sphereGeometry args={[1, 10, 10]} />
                <SoftMat color="#fff2a8" boost={0.44} />
              </mesh>
              <mesh position={[0, -0.068, 0]}>
                <boxGeometry args={[0.022, 0.016, 0.020]} />
                <SoftMat color="#d9a672" boost={0.34} />
              </mesh>
            </group>
            {/* Lush summer hillside grove + pasture fence + wildflower bushes */}
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.13} v={0.36}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={1.0} col1="#5cb862" col2="#82da7c" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.18} v={0.56}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.92} col1="#72cc70" col2="#9ae68c" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.29} v={0.32}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.88} col1="#52ad5a" col2="#76cf74" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.34} v={0.50}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.90} col1="#68c468" col2="#8ee284" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.44} v={0.60}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.80} col1="#58b560" col2="#7ad476" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.56} v={0.34}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.84} col1="#6ec96c" col2="#96e48a" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.26} v={0.70} sink={0.004}>
              <MiniFence3D pos={[0, 0, 0]} rotY={0.14} col="#e8d0aa" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.11} v={0.74} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={1.04} col1="#62bf68" col2="#86db7e" flowerCol="#fff294" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.37} v={0.75} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.94} col1="#6ec96c" col2="#96e48a" flowerCol="#ffffff" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.20} v={0.76} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.88} col1="#5ab862" col2="#7ed478" flowerCol="#ffea82" />
            </SlopeAnchor>
          </>
        ) : (
          <>
            <SoftCloud3D x={0.44} y={0.84} z={0.12} sc={0.94} col="#ffffff" />
            <SoftCloud3D x={0.78} y={0.80} z={0.14} sc={1.06} col="#ffffff" />
            <SoftCloud3D x={0.62} y={0.72} z={0.11} sc={0.72} col="#ffffff" />
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.46} v={0.36}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.92} col1="#5cb862" col2="#82da7c" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.54} v={0.48}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.94} col1="#6ec96c" col2="#96e48a" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.61} v={0.64}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.82} col1="#54b05c" col2="#7ad476" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.90} v={0.48}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.86} col1="#72cc70" col2="#9ce88e" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.49} v={0.72} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.98} col1="#62bf68" col2="#86db7e" flowerCol="#fff294" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.88} v={0.70} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.92} col1="#6ec96c" col2="#96e48a" flowerCol="#ffffff" />
            </SlopeAnchor>
          </>
        ))}

      {/* ==================== AUTUMN 3D WALL DETAILS ==================== */}
      {season === "autumn" &&
        (wall === "left" ? (
          <>
            <SoftCloud3D x={0.20} y={0.84} z={0.14} sc={1.06} col="#fff7eb" />
            <SoftCloud3D x={0.45} y={0.77} z={0.11} sc={0.76} col="#ffefe0" />
            <SoftCloud3D x={0.64} y={0.86} z={0.12} sc={0.86} col="#ffefe0" />
            {/* Cozy autumn terracotta-roofed hillside barn/cottage perched cleanly on the broad slope */}
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.23} v={0.44} sink={0.004}>
              <MiniCottage3D pos={[0, 0, 0]} sc={1.06} rotY={0.26} wallCol="#fae8ce" roofCol="#df6e4e" windowCol="#ffe27a" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.33} v={0.62} sink={0.004}>
              <MiniFence3D pos={[0, 0, 0]} rotY={-0.16} col="#d6a476" />
            </SlopeAnchor>
            {/* Warm maple & ginkgo tapestry across both broad mountain layers */}
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.13} v={0.36}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={1.0} col1="#ee724c" col2="#ffaa58" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.14} v={0.60}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.90} col1="#f5b44e" col2="#ffdc78" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.32} v={0.32}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.90} col1="#e86646" col2="#ff9a52" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.38} v={0.48}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.86} col1="#f7bc54" col2="#ffe27e" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.46} v={0.62}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.80} col1="#ee744e" col2="#ffad5c" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.57} v={0.34}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.82} col1="#f5b44e" col2="#ffdc78" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.10} v={0.76} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={1.02} col1="#e88a4c" col2="#f7b462" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.26} v={0.74} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.94} col1="#f0a852" col2="#ffcf78" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.43} v={0.76} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.90} col1="#e2764a" col2="#f5a05a" />
            </SlopeAnchor>
          </>
        ) : (
          <>
            <SoftCloud3D x={0.44} y={0.85} z={0.12} sc={0.92} col="#fff7eb" />
            <SoftCloud3D x={0.78} y={0.80} z={0.14} sc={1.06} col="#ffefe0" />
            <SoftCloud3D x={0.62} y={0.72} z={0.11} sc={0.70} col="#fff7eb" />
            <SlopeAnchor cfgs={cfgs} layer="back" u={0.46} v={0.36}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.90} col1="#ee724c" col2="#ffaa58" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.52} v={0.56}>
              <MiniClusterTree3D pos={[0, 0, 0]} sc={0.80} col1="#f7b854" col2="#ffe07a" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.48} v={0.72} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.98} col1="#e88a4c" col2="#f7b462" />
            </SlopeAnchor>
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.85} v={0.72} sink={0.004}>
              <MiniBush3D pos={[0, 0, 0]} sc={0.92} col1="#f0a852" col2="#ffcf78" />
            </SlopeAnchor>
            {/* Full volumetric rotating 3D hillside windmill on the outer-right ridge (100% clear of ground cottage & signpost!) */}
            <SlopeAnchor cfgs={cfgs} layer="front" u={0.90} v={0.34} sink={0.004}>
              <group scale={1.06}>
                <mesh position={[0, 0.036, 0]}>
                  <cylinderGeometry args={[0.015, 0.024, 0.072, 7]} />
                  <SoftMat color="#f7e4ca" boost={0.34} />
                </mesh>
                <mesh position={[0, 0.080, 0]}>
                  <coneGeometry args={[0.022, 0.026, 7]} />
                  <SoftMat color="#e07452" boost={0.36} />
                </mesh>
                <mesh position={[0, 0.022, 0.020]}>
                  <boxGeometry args={[0.010, 0.014, 0.004]} />
                  <meshBasicMaterial color="#ffe484" />
                </mesh>
                <group ref={windmillBladesRef} position={[0, 0.062, 0.022]}>
                  {[0, 1, 2, 3].map((k) => (
                    <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
                      <boxGeometry args={[0.0085, 0.074, 0.004]} />
                      <SoftMat color="#ffe6b0" boost={0.42} />
                    </mesh>
                  ))}
                </group>
              </group>
            </SlopeAnchor>
          </>
        ))}

      {/* ==================== WINTER 3D WALL DETAILS ==================== */}
      {season === "winter" && (
        <>
          {(wall === "left"
            ? ([
                [0.14, 0.86, 0.016],
                [0.28, 0.79, 0.011],
                [0.42, 0.88, 0.015],
                [0.56, 0.82, 0.012],
                [0.70, 0.86, 0.014],
                [0.18, 0.68, 0.011],
                [0.34, 0.66, 0.010],
                [0.50, 0.72, 0.009],
                [0.24, 0.91, 0.010],
              ] as [number, number, number][])
            : ([
                [0.36, 0.86, 0.014],
                [0.50, 0.80, 0.012],
                [0.64, 0.88, 0.016],
                [0.78, 0.82, 0.013],
                [0.88, 0.72, 0.012],
                [0.58, 0.70, 0.010],
                [0.74, 0.68, 0.011],
                [0.86, 0.86, 0.010],
                [0.44, 0.72, 0.009],
              ] as [number, number, number][])
          ).map(([sx, sy, sr], i) => (
            <mesh
              key={i}
              ref={(el) => {
                starRefs.current[i] = el;
              }}
              position={[sx * L, sy * H, 0.024]}
              scale={[1, 1, 0.45]}
            >
              <octahedronGeometry args={[sr, 0]} />
              <meshBasicMaterial color="#fff8d6" />
            </mesh>
          ))}
          {wall === "left" ? (
            <>
              <SoftCloud3D x={0.22} y={0.76} z={0.12} sc={0.82} col="#bfd3f2" boost={0.18} />
              {/* Cozy glowing alpine mountain chalet nestled cleanly on the broad snowy slope */}
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.23} v={0.44} sink={0.004}>
                <MiniCottage3D pos={[0, 0, 0]} sc={1.06} rotY={0.28} wallCol="#b88b68" roofCol="#e4f0ff" windowCol="#ffe588" snowRoof />
              </SlopeAnchor>
              {/* Dense multi-depth snow-capped alpine pine forest */}
              <SlopeAnchor cfgs={cfgs} layer="back" u={0.12} v={0.36}>
                <TieredPine3D pos={[0, 0, 0]} sc={1.06} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.14} v={0.60}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.94} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="back" u={0.32} v={0.32}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.96} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.37} v={0.50}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.92} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.45} v={0.64}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.84} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="back" u={0.54} v={0.36}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.88} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.11} v={0.76} sink={0.004}>
                <MiniBush3D pos={[0, 0, 0]} sc={0.96} col1="#6084a4" col2="#d8e8fa" />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.29} v={0.74} sink={0.004}>
                <MiniBush3D pos={[0, 0, 0]} sc={0.90} col1="#6084a4" col2="#d8e8fa" />
              </SlopeAnchor>
            </>
          ) : (
            <>
              <SoftCloud3D x={0.78} y={0.76} z={0.12} sc={0.84} col="#bfd3f2" boost={0.18} />
              <SlopeAnchor cfgs={cfgs} layer="back" u={0.46} v={0.36}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.98} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.54} v={0.48}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.96} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.61} v={0.64}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.84} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.90} v={0.48}>
                <TieredPine3D pos={[0, 0, 0]} sc={0.90} />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.48} v={0.72} sink={0.004}>
                <MiniBush3D pos={[0, 0, 0]} sc={0.92} col1="#6084a4" col2="#d8e8fa" />
              </SlopeAnchor>
              <SlopeAnchor cfgs={cfgs} layer="front" u={0.88} v={0.70} sink={0.004}>
                <MiniBush3D pos={[0, 0, 0]} sc={0.86} col1="#6084a4" col2="#d8e8fa" />
              </SlopeAnchor>
            </>
          )}
        </>
      )}
    </group>
    </ClipPlanesCtx.Provider>
  );
}
