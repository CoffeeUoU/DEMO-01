"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Season = "spring" | "summer" | "autumn" | "winter";

type ClusterSpec = {
  pos: [number, number, number];
  scale: [number, number, number];
  rot: [number, number, number];
  color: string;
  phase: number;
};

const INK_COLOR = "#463d66";

function makeRng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createOrganicBlobGeo(detail = 2): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      1 +
      0.12 * Math.sin(v.x * 3.4 + v.y * 2.1) +
      0.08 * Math.cos(v.z * 3.8 - v.y * 2.7) +
      0.05 * Math.sin((v.x + v.z) * 5.2);
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createTaperedBranch(points: [number, number, number][], rStart: number, rEnd: number, tubularSegs = 12, radialSegs = 8): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    curve.getPointAt(u, p);
    const r = rStart + (rEnd - rStart) * Math.pow(u, 0.85);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      n.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z);
      positions.push(p.x + r * n.x, p.y + r * n.y, p.z + r * n.z);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const SHARED_BLOB_GEO = createOrganicBlobGeo(2);

/** Subtle soft-ink outline so 3D props blend seamlessly with the hand-drawn book pages. */
const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: INK_COLOR,
  side: THREE.BackSide,
});

/** Bright, airy storybook material (prevents dark linear shading). */
function BrightMat({ color, boost = 0.28, opacity = 1 }: { color: string; boost?: number; opacity?: number }) {
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

const BRANCH_DEFS: { pts: [number, number, number][]; r0: number; r1: number; snowPos: [number, number, number] }[] = [
  // Main curving trunk
  {
    pts: [
      [0, 0.0, 0],
      [0.015, 0.14, 0.01],
      [-0.012, 0.30, -0.008],
      [0.008, 0.44, 0.005],
    ],
    r0: 0.064,
    r1: 0.034,
    snowPos: [0.008, 0.45, 0.005],
  },
  // 4 gripping surface roots
  { pts: [[-0.02, 0.06, 0.01], [-0.09, 0.025, 0.04], [-0.14, 0.004, 0.07]], r0: 0.030, r1: 0.008, snowPos: [-0.09, 0.042, 0.04] },
  { pts: [[0.02, 0.06, 0.02], [0.09, 0.025, 0.06], [0.15, 0.004, 0.08]], r0: 0.030, r1: 0.008, snowPos: [0.09, 0.042, 0.06] },
  { pts: [[-0.01, 0.06, -0.02], [-0.08, 0.025, -0.07], [-0.13, 0.004, -0.10]], r0: 0.028, r1: 0.008, snowPos: [-0.08, 0.042, -0.07] },
  { pts: [[0.02, 0.06, -0.02], [0.08, 0.025, -0.07], [0.14, 0.004, -0.09]], r0: 0.028, r1: 0.008, snowPos: [0.08, 0.042, -0.07] },

  // 6 sweeping primary 3D boughs
  { pts: [[-0.008, 0.34, 0.0], [-0.11, 0.44, 0.06], [-0.23, 0.50, 0.11], [-0.30, 0.53, 0.13]], r0: 0.032, r1: 0.009, snowPos: [-0.20, 0.51, 0.09] },
  { pts: [[0.008, 0.36, 0.005], [0.13, 0.45, 0.07], [0.24, 0.50, 0.10], [0.31, 0.52, 0.12]], r0: 0.033, r1: 0.009, snowPos: [0.21, 0.51, 0.09] },
  { pts: [[-0.005, 0.37, -0.008], [-0.12, 0.47, -0.09], [-0.21, 0.56, -0.15], [-0.27, 0.61, -0.18]], r0: 0.030, r1: 0.008, snowPos: [-0.18, 0.57, -0.13] },
  { pts: [[0.005, 0.38, -0.006], [0.12, 0.48, -0.09], [0.22, 0.57, -0.14], [0.28, 0.63, -0.17]], r0: 0.030, r1: 0.008, snowPos: [0.19, 0.58, -0.13] },
  { pts: [[0.004, 0.42, 0.004], [-0.04, 0.56, 0.04], [-0.08, 0.68, 0.06], [-0.11, 0.76, 0.07]], r0: 0.028, r1: 0.008, snowPos: [-0.07, 0.70, 0.05] },
  { pts: [[0.008, 0.42, 0.002], [0.05, 0.57, -0.03], [0.09, 0.69, -0.05], [0.13, 0.77, -0.06]], r0: 0.028, r1: 0.008, snowPos: [0.08, 0.71, -0.04] },

  // Secondary twigs
  { pts: [[-0.14, 0.46, 0.07], [-0.16, 0.57, 0.12], [-0.18, 0.64, 0.16]], r0: 0.016, r1: 0.005, snowPos: [-0.16, 0.61, 0.14] },
  { pts: [[0.15, 0.47, 0.08], [0.18, 0.58, 0.14], [0.20, 0.65, 0.17]], r0: 0.016, r1: 0.005, snowPos: [0.18, 0.61, 0.15] },
  { pts: [[-0.14, 0.50, -0.11], [-0.10, 0.62, -0.15], [-0.08, 0.70, -0.18]], r0: 0.015, r1: 0.005, snowPos: [-0.10, 0.65, -0.16] },
  { pts: [[0.14, 0.50, -0.10], [0.17, 0.63, -0.11], [0.21, 0.71, -0.10]], r0: 0.015, r1: 0.005, snowPos: [0.18, 0.66, -0.11] },
  { pts: [[-0.04, 0.58, 0.04], [0.01, 0.72, 0.03], [0.03, 0.81, 0.01]], r0: 0.017, r1: 0.005, snowPos: [0.01, 0.76, 0.02] },
];

/** Cute 3D fluffy cloud drifting gently in the upper corners of the diorama. */
function Cloud3D({ pos, scale = 1, color = "#ffffff" }: { pos: [number, number, number]; scale?: number; color?: string }) {
  return (
    <group position={pos} scale={scale}>
      <mesh geometry={SHARED_BLOB_GEO} position={[0, 0.01, 0]} scale={[0.09, 0.055, 0.06]}>
        <BrightMat color={color} boost={0.45} />
      </mesh>
      <mesh geometry={SHARED_BLOB_GEO} position={[-0.065, -0.008, 0.005]} scale={[0.062, 0.044, 0.05]}>
        <BrightMat color={color} boost={0.45} />
      </mesh>
      <mesh geometry={SHARED_BLOB_GEO} position={[0.068, -0.005, -0.005]} scale={[0.066, 0.046, 0.05]}>
        <BrightMat color={color} boost={0.45} />
      </mesh>
    </group>
  );
}

/** Cozy 3D miniature storybook cottage tucked into the hillside (autumn & winter). */
function Cottage3D({ pos, rotY, snowy }: { pos: [number, number, number]; rotY: number; snowy: boolean }) {
  const roofCol = snowy ? "#f5f9ff" : "#e38462";
  const wallCol = snowy ? "#eef4fa" : "#fff2dc";
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Cottage walls */}
      <mesh position={[0, 0.065, 0]}>
        <boxGeometry args={[0.14, 0.13, 0.12]} />
        <BrightMat color={wallCol} boost={0.32} />
      </mesh>
      <mesh position={[0, 0.065, 0]} scale={1.04} material={OUTLINE_MAT}>
        <boxGeometry args={[0.14, 0.13, 0.12]} />
      </mesh>
      {/* Pitched pyramid roof */}
      <mesh position={[0, 0.165, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.125, 0.10, 4]} />
        <BrightMat color={roofCol} boost={0.32} />
      </mesh>
      <mesh position={[0, 0.165, 0]} rotation={[0, Math.PI / 4, 0]} scale={1.05} material={OUTLINE_MAT}>
        <coneGeometry args={[0.125, 0.10, 4]} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.042, 0.185, -0.02]}>
        <boxGeometry args={[0.024, 0.06, 0.024]} />
        <BrightMat color="#c89b82" boost={0.28} />
      </mesh>
      {/* Warm glowing windows & door */}
      <mesh position={[0, 0.042, 0.062]}>
        <boxGeometry args={[0.034, 0.065, 0.008]} />
        <BrightMat color="#b8845e" boost={0.25} />
      </mesh>
      <mesh position={[-0.042, 0.072, 0.062]}>
        <boxGeometry args={[0.028, 0.028, 0.008]} />
        <meshBasicMaterial color="#ffe48c" />
      </mesh>
      <mesh position={[0.042, 0.072, 0.062]}>
        <boxGeometry args={[0.028, 0.028, 0.008]} />
        <meshBasicMaterial color="#ffe48c" />
      </mesh>
    </group>
  );
}

/** Miniature 3D evergreen pine tree for winter depth. */
function MiniPine3D({ pos, scale = 1 }: { pos: [number, number, number]; scale?: number }) {
  return (
    <group position={pos} scale={scale}>
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.014, 0.018, 0.07, 7]} />
        <BrightMat color="#9e8578" boost={0.28} />
      </mesh>
      {[
        [0.09, 0.08, 0.095],
        [0.145, 0.065, 0.085],
        [0.195, 0.048, 0.075],
      ].map(([y, r, h], i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh>
            <coneGeometry args={[r, h, 8]} />
            <BrightMat color="#9ec4cf" boost={0.32} />
          </mesh>
          <mesh position={[0, h * 0.16, 0]}>
            <coneGeometry args={[r * 0.72, h * 0.65, 8]} />
            <BrightMat color="#f6fbff" boost={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Cozy snow-topped wooden birdhouse hanging from a winter bough. */
function Birdhouse3D({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Hanging string */}
      <mesh position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.0025, 0.0025, 0.06, 5]} />
        <meshBasicMaterial color={INK_COLOR} />
      </mesh>
      {/* House body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.052, 0.058, 0.048]} />
        <BrightMat color="#e2b98f" boost={0.32} />
      </mesh>
      <mesh position={[0, 0, 0]} scale={1.06} material={OUTLINE_MAT}>
        <boxGeometry args={[0.052, 0.058, 0.048]} />
      </mesh>
      {/* Snow-covered roof */}
      <mesh position={[0, 0.044, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.050, 0.036, 4]} />
        <BrightMat color="#f6fbff" boost={0.46} />
      </mesh>
      {/* Dark round entrance & little perch */}
      <mesh position={[0, 0.004, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.004, 10]} />
        <meshBasicMaterial color={INK_COLOR} />
      </mesh>
      <mesh position={[0, -0.014, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.018, 6]} />
        <BrightMat color="#c89b6e" boost={0.30} />
      </mesh>
    </group>
  );
}

/** Delicate 5-petal 3D red plum blossom with golden stamen for the snowy winter crown. */
function PlumBlossom3D({
  pos,
  rot,
  scale = 1,
  color = "#e84a5f",
}: {
  pos: [number, number, number];
  rot: [number, number, number];
  scale?: number;
  color?: string;
}) {
  return (
    <group position={pos} rotation={rot} scale={scale}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.015, Math.sin(a) * 0.015, 0]} scale={[1.0, 1.0, 0.45]}>
            <sphereGeometry args={[0.013, 8, 8]} />
            <BrightMat color={color} boost={0.46} />
          </mesh>
        );
      })}
      {/* Golden stamen center */}
      <mesh position={[0, 0, 0.005]}>
        <sphereGeometry args={[0.007, 7, 7]} />
        <meshBasicMaterial color="#ffe478" />
      </mesh>
    </group>
  );
}

function subRange(p: number, a: number, b: number) {
  return Math.max(0, Math.min(1, (p - a) / (b - a)));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Gentle pop-up spring overshoot for blooming canopy & storybook props. */
function easeOutBack(t: number, overshoot = 1.55) {
  const u = t - 1;
  return 1 + (overshoot + 1) * u * u * u + overshoot * u * u;
}

export default function SeasonTree3D({
  season,
  progressRef,
}: {
  season: Season;
  progressRef?: { current: number };
}) {
  const bgStageRef = useRef<THREE.Group | null>(null);
  const trunkRef = useRef<THREE.Group | null>(null);
  const canopyRef = useRef<THREE.Group | null>(null);
  const clusterRefs = useRef<(THREE.Group | null)[]>([]);
  const bloomExtrasRef = useRef<THREE.Group | null>(null);
  const propsRef = useRef<THREE.Group | null>(null);
  const particlesGroupRef = useRef<THREE.Group | null>(null);
  const swingRef = useRef<THREE.Group | null>(null);
  const windmillRef = useRef<THREE.Group | null>(null);
  const cloudGroupRef = useRef<THREE.Group | null>(null);
  const lanternLRef = useRef<THREE.Group | null>(null);
  const lanternRRef = useRef<THREE.Group | null>(null);
  const smokeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fairyRefs = useRef<(THREE.Mesh | null)[]>([]);

  const branchGeos = useMemo(() => BRANCH_DEFS.map((b) => createTaperedBranch(b.pts, b.r0, b.r1, 12, 8)), []);

  // Bright, vibrant storybook palettes per season
  const palette = useMemo(() => {
    switch (season) {
      case "spring":
        return {
          bark: "#b99272",
          mound: "#c7ebb0",
          hillBack: "#c2e6b8",
          hillMid: "#d4f0be",
          hillSide: "#b5e0ae",
          fence: "#edd3b0",
          scaleY: 1.0,
          scaleXZ: 1.0,
        };
      case "summer":
        return {
          bark: "#a67d5d",
          mound: "#9ee08c",
          hillBack: "#8dd696",
          hillMid: "#a6e39b",
          hillSide: "#7ec98a",
          fence: "#e4c29a",
          scaleY: 1.06,
          scaleXZ: 1.07,
        };
      case "autumn":
        return {
          bark: "#ad7e5c",
          mound: "#f7d99e",
          hillBack: "#f3be8a",
          hillMid: "#f8d39a",
          hillSide: "#eba775",
          fence: "#deb286",
          scaleY: 1.0,
          scaleXZ: 1.0,
        };
      case "winter":
        return {
          bark: "#a8a4b8",
          mound: "#f2f8ff",
          hillBack: "#cfe2f7",
          hillMid: "#e6f2ff",
          hillSide: "#d9eafc",
          fence: "#c7d6e8",
          scaleY: 0.98,
          scaleXZ: 0.98,
        };
    }
  }, [season]);

  // 3D Foliage clusters — bright & joyful, evolving across seasons
  const clusters = useMemo<ClusterSpec[]>(() => {
    const r = makeRng(season === "spring" ? 11 : season === "summer" ? 22 : season === "autumn" ? 33 : 44);
    const out: ClusterSpec[] = [];

    if (season === "spring") {
      // Full, lush sakura blossom canopy matching summer's richness
      const cols = ["#ffd6e5", "#ffc2d9", "#ffe8f1", "#ffb3cf", "#daf4c4"];
      const anchors: [number, number, number, number][] = [
        [-0.25, 0.55, 0.11, 0.16],
        [0.26, 0.54, 0.11, 0.16],
        [-0.21, 0.63, -0.15, 0.155],
        [0.22, 0.64, -0.14, 0.155],
        [-0.09, 0.76, 0.07, 0.17],
        [0.11, 0.77, -0.06, 0.17],
        [0.01, 0.83, 0.01, 0.18],
        [-0.15, 0.65, 0.15, 0.14],
        [0.17, 0.65, 0.15, 0.14],
        [0.0, 0.66, -0.16, 0.15],
        [0.0, 0.56, 0.13, 0.138],
        [0.0, 0.70, 0.0, 0.155],
      ];
      for (const [ax, ay, az, rad] of anchors) {
        for (let k = 0; k < 3; k++) {
          const sc = rad * (0.74 + r() * 0.42);
          out.push({
            pos: [ax + (r() - 0.5) * 0.14, ay + (r() - 0.5) * 0.09, az + (r() - 0.5) * 0.14],
            scale: [sc * 1.18, sc * 0.92, sc * 1.14],
            rot: [r() * 3, r() * 3, r() * 3],
            color: cols[Math.floor(r() * cols.length)],
            phase: r() * 6.28,
          });
        }
      }
    } else if (season === "summer") {
      const cols = ["#79cc76", "#95de82", "#65bf6d", "#b5eb8c", "#83d47a"];
      const anchors: [number, number, number, number][] = [
        [-0.26, 0.55, 0.11, 0.165],
        [0.27, 0.54, 0.11, 0.165],
        [-0.21, 0.63, -0.15, 0.16],
        [0.22, 0.64, -0.14, 0.16],
        [-0.09, 0.76, 0.07, 0.175],
        [0.11, 0.77, -0.06, 0.175],
        [0.01, 0.84, 0.01, 0.185],
        [-0.16, 0.65, 0.15, 0.145],
        [0.17, 0.65, 0.15, 0.145],
        [0.0, 0.66, -0.16, 0.155],
        [0.0, 0.56, 0.13, 0.14],
        [0.0, 0.70, 0.0, 0.16],
      ];
      for (const [ax, ay, az, rad] of anchors) {
        for (let k = 0; k < 3; k++) {
          const sc = rad * (0.74 + r() * 0.42);
          out.push({
            pos: [ax + (r() - 0.5) * 0.14, ay + (r() - 0.5) * 0.09, az + (r() - 0.5) * 0.14],
            scale: [sc * 1.18, sc * 0.92, sc * 1.15],
            rot: [r() * 3, r() * 3, r() * 3],
            color: cols[Math.floor(r() * cols.length)],
            phase: r() * 6.28,
          });
        }
      }
    } else if (season === "autumn") {
      // Lush, full autumn maple & ginkgo canopy matching summer's fullness
      const cols = ["#ff9a5a", "#ffc45c", "#f57656", "#ffda75", "#fba95c"];
      const anchors: [number, number, number, number][] = [
        [-0.25, 0.55, 0.11, 0.158],
        [0.26, 0.54, 0.11, 0.158],
        [-0.21, 0.63, -0.15, 0.154],
        [0.22, 0.64, -0.14, 0.154],
        [-0.09, 0.76, 0.07, 0.168],
        [0.11, 0.77, -0.06, 0.168],
        [0.01, 0.83, 0.01, 0.178],
        [-0.15, 0.65, 0.15, 0.14],
        [0.17, 0.65, 0.15, 0.14],
        [0.0, 0.66, -0.16, 0.148],
        [0.0, 0.56, 0.13, 0.136],
        [0.0, 0.70, 0.0, 0.152],
      ];
      for (const [ax, ay, az, rad] of anchors) {
        for (let k = 0; k < 3; k++) {
          const sc = rad * (0.74 + r() * 0.42);
          out.push({
            pos: [ax + (r() - 0.5) * 0.14, ay + (r() - 0.5) * 0.09, az + (r() - 0.5) * 0.14],
            scale: [sc * 1.18, sc * 0.90, sc * 1.14],
            rot: [r() * 3, r() * 3, r() * 3],
            color: cols[Math.floor(r() * cols.length)],
            phase: r() * 6.28,
          });
        }
      }
    } else {
      // Winter: lush snow-laden canopy (slightly airier than autumn) — looks like soft snow blanketing the tree
      const snowCols = ["#ffffff", "#f5faff", "#eaf4ff", "#ffffff", "#e2f0fe"];
      const anchors: [number, number, number, number][] = [
        [-0.24, 0.55, 0.11, 0.140],
        [0.25, 0.54, 0.10, 0.140],
        [-0.20, 0.63, -0.14, 0.136],
        [0.21, 0.64, -0.13, 0.136],
        [-0.08, 0.75, 0.06, 0.150],
        [0.10, 0.76, -0.05, 0.150],
        [0.01, 0.82, 0.01, 0.158],
        [-0.14, 0.64, 0.14, 0.124],
        [0.16, 0.64, 0.14, 0.124],
        [0.0, 0.66, -0.14, 0.132],
      ];
      for (const [ax, ay, az, rad] of anchors) {
        for (let k = 0; k < 3; k++) {
          const sc = rad * (0.72 + r() * 0.40);
          out.push({
            pos: [ax + (r() - 0.5) * 0.13, ay + (r() - 0.5) * 0.08, az + (r() - 0.5) * 0.13],
            scale: [sc * 1.16, sc * 0.88, sc * 1.12],
            rot: [r() * 3, r() * 3, r() * 3],
            color: snowCols[Math.floor(r() * snowCols.length)],
            phase: r() * 6.28,
          });
        }
      }
    }
    return out;
  }, [season]);

  // 28 blooming 3D crimson & rose-red plum blossoms nestled across the snowy winter canopy
  const winterPlumBlossoms = useMemo(() => {
    const r = makeRng(909);
    const cols = ["#e8465a", "#f25c6e", "#d9384e", "#ff7588", "#e54b5e"];
    const spots: [number, number, number][] = [
      [-0.28, 0.58, 0.21],
      [-0.20, 0.64, 0.24],
      [-0.10, 0.78, 0.19],
      [0.02, 0.88, 0.14],
      [0.14, 0.80, 0.16],
      [0.24, 0.66, 0.23],
      [0.31, 0.56, 0.20],
      [-0.02, 0.68, 0.22],
      [0.08, 0.62, 0.23],
      [-0.14, 0.54, 0.23],
      [0.16, 0.53, 0.22],
      [-0.34, 0.54, 0.08],
      [0.35, 0.53, 0.06],
      [-0.26, 0.68, -0.04],
      [0.27, 0.69, -0.03],
      [-0.18, 0.78, -0.08],
      [0.18, 0.79, -0.09],
      [0.0, 0.92, 0.02],
      [-0.12, 0.86, 0.08],
      [0.11, 0.86, 0.05],
      [-0.25, 0.64, -0.22],
      [0.25, 0.65, -0.21],
      [0.0, 0.72, -0.24],
      [-0.07, 0.60, 0.24],
      [0.21, 0.72, 0.12],
      [-0.22, 0.72, 0.12],
    ];
    return spots.map(([x, y, z]) => {
      // Orient each blossom generally outward from the canopy center (0, 0.66, 0)
      const yaw = Math.atan2(x, z);
      const pitch = -(y - 0.66) * 1.4;
      return {
        pos: [x, y, z] as [number, number, number],
        rot: [pitch, yaw, r() * 6.28] as [number, number, number],
        scale: 0.92 + r() * 0.45,
        color: cols[Math.floor(r() * cols.length)],
      };
    });
  }, []);

  // Winter fairy string lights draped gracefully between the 3D boughs
  const winterFairyLights = useMemo(() => {
    const garlands: [[number, number, number], [number, number, number], number][] = [
      [[-0.28, 0.52, 0.12], [-0.08, 0.68, 0.06], 6],
      [[-0.08, 0.68, 0.06], [0.10, 0.69, -0.04], 5],
      [[0.10, 0.69, -0.04], [0.29, 0.52, 0.11], 6],
      [[-0.24, 0.58, -0.15], [0.01, 0.76, 0.02], 5],
      [[0.01, 0.76, 0.02], [0.25, 0.59, -0.14], 5],
      [[-0.22, 0.50, 0.10], [0.23, 0.50, 0.10], 7],
    ];
    const bulbs: { pos: [number, number, number]; color: string; phase: number }[] = [];
    const wireGeos: THREE.BufferGeometry[] = [];
    const cols = ["#ffe896", "#fff4c2", "#ffd278", "#ffe0a8"];
    garlands.forEach(([a, b, count], gIdx) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const sag = Math.sin(u * Math.PI) * 0.055;
        pts.push(
          new THREE.Vector3(
            a[0] + (b[0] - a[0]) * u,
            a[1] + (b[1] - a[1]) * u - sag,
            a[2] + (b[2] - a[2]) * u,
          ),
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      wireGeos.push(new THREE.TubeGeometry(curve, 12, 0.0022, 5, false));
      for (let k = 1; k < count; k++) {
        const p = curve.getPointAt(k / count);
        bulbs.push({
          pos: [p.x, p.y - 0.006, p.z],
          color: cols[(gIdx + k) % cols.length],
          phase: gIdx * 1.3 + k * 0.9,
        });
      }
    });
    return { bulbs, wireGeos };
  }, []);

  // Winter red holly berry clusters & crystal icicles hanging from the boughs
  const winterOrnaments = useMemo(() => {
    const berries: [number, number, number][] = [
      [-0.22, 0.53, 0.11],
      [-0.12, 0.48, 0.07],
      [0.16, 0.50, 0.09],
      [0.26, 0.54, 0.11],
      [-0.16, 0.60, -0.12],
      [0.18, 0.62, -0.12],
      [-0.06, 0.72, 0.05],
      [0.08, 0.73, -0.04],
      [0.02, 0.79, 0.02],
      [-0.17, 0.63, 0.15],
    ];
    const icicles: [number, number, number, number][] = [
      [-0.27, 0.49, 0.12, 0.065],
      [-0.19, 0.46, 0.09, 0.052],
      [-0.10, 0.42, 0.05, 0.045],
      [0.13, 0.43, 0.06, 0.048],
      [0.24, 0.48, 0.10, 0.068],
      [0.30, 0.49, 0.12, 0.050],
      [-0.23, 0.55, -0.16, 0.058],
      [0.23, 0.56, -0.15, 0.060],
      [-0.15, 0.60, 0.14, 0.045],
      [0.18, 0.60, 0.15, 0.048],
    ];
    return { berries, icicles };
  }, []);

  // Spring 3D flower field
  const springFlowers = useMemo(() => {
    const r = makeRng(555);
    const cols = ["#ffb3cf", "#ffe484", "#c4d9ff", "#ffffff", "#ffc4a3"];
    return Array.from({ length: 22 }, () => {
      const x = (r() - 0.5) * 0.62;
      const z = 0.08 + r() * 0.36;
      return { x, z, h: 0.035 + r() * 0.025, col: cols[Math.floor(r() * cols.length)] };
    }).filter((f) => Math.abs(f.x) + Math.abs(f.z) < 0.58);
  }, []);

  // 3D particles
  const particles = useMemo(() => {
    const r = makeRng(season === "spring" ? 101 : season === "summer" ? 202 : season === "autumn" ? 303 : 404);
    const count = season === "winter" ? 44 : season === "summer" ? 26 : 34;
    const cols =
      season === "spring"
        ? ["#ffc7dc", "#ffe8f2", "#ffa8c8"]
        : season === "summer"
          ? ["#fff08a", "#d8ff99"]
          : season === "autumn"
            ? ["#ff9452", "#ffd566", "#f0654a"]
            : ["#ffffff", "#e8f4ff"];
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * 0.72,
      y: 0.08 + r() * 0.88,
      z: (r() - 0.5) * 0.72,
      spd: season === "summer" ? 0.08 + r() * 0.08 : 0.14 + r() * 0.14,
      phase: r() * 6.28,
      size: season === "winter" ? 0.012 + r() * 0.008 : season === "summer" ? 0.011 + r() * 0.007 : 0.018 + r() * 0.01,
      color: cols[Math.floor(r() * cols.length)],
    }));
  }, [season]);

  const autumnPile = useMemo(() => {
    const r = makeRng(777);
    const cols = ["#ff9854", "#ffd266", "#f0684d", "#fcb25e"];
    return Array.from({ length: 20 }, () => {
      const a = r() * Math.PI * 2;
      const dist = 0.09 + r() * 0.25;
      return {
        pos: [Math.cos(a) * dist, 0.016 + r() * 0.012, Math.sin(a) * dist] as [number, number, number],
        rot: [0, r() * 6.28, 0] as [number, number, number],
        scale: [0.032 + r() * 0.02, 0.009, 0.022 + r() * 0.015] as [number, number, number],
        color: cols[Math.floor(r() * cols.length)],
      };
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const prog = progressRef ? progressRef.current : 1;

    // Layer 1 (Hero): Central 3D trunk & canopy ride the folding crease from the start so the transition is never empty!
    if (trunkRef.current) {
      const k = easeOutCubic(subRange(prog, 0.02, 0.48));
      trunkRef.current.visible = k > 0.01;
      trunkRef.current.scale.set(
        palette.scaleXZ * (0.35 + 0.65 * k),
        palette.scaleY * Math.max(0.02, k),
        palette.scaleXZ * (0.35 + 0.65 * k),
      );
      trunkRef.current.rotation.x = (1 - k) * -0.14;
    }

    // Layer 2 (Hero Bloom): Individual 3D canopy clusters bloom in a staggered wave with soft spring overshoot
    for (let i = 0; i < clusters.length; i++) {
      const g = clusterRefs.current[i];
      if (!g) continue;
      const delay = (i / Math.max(1, clusters.length)) * 0.24;
      const raw = subRange(prog, 0.16 + delay, 0.56 + delay);
      g.visible = raw > 0.005;
      if (raw > 0.005) {
        const b = Math.max(0.001, easeOutBack(raw, 1.4));
        const c = clusters[i];
        g.scale.set(c.scale[0] * b, c.scale[1] * b, c.scale[2] * b);
      }
    }
    if (bloomExtrasRef.current) {
      const raw = subRange(prog, 0.48, 0.86);
      bloomExtrasRef.current.visible = raw > 0.005;
      const b = Math.max(0.001, easeOutBack(raw, 1.55));
      bloomExtrasRef.current.scale.setScalar(b);
    }

    // Layer 3 & 4: Grounded background hills & foreground props pop up once the floor settles flat (zero floor clipping!)
    if (bgStageRef.current) {
      const k = easeOutCubic(subRange(prog, 0.62, 0.92));
      bgStageRef.current.visible = k > 0.01;
      bgStageRef.current.scale.set(0.6 + 0.4 * k, Math.max(0.001, k), 0.6 + 0.4 * k);
    }
    if (propsRef.current) {
      const raw = subRange(prog, 0.66, 0.96);
      propsRef.current.visible = raw > 0.01;
      const b = Math.max(0.001, easeOutBack(raw, 1.15));
      propsRef.current.scale.set(0.55 + 0.45 * b, b, 0.55 + 0.45 * b);
    }

    // Layer 5: Floating 3D clouds/sun/moon settle gracefully + seasonal particles fade in
    if (cloudGroupRef.current) {
      const k = easeOutCubic(subRange(prog, 0.42, 0.88));
      cloudGroupRef.current.visible = k > 0.005;
      cloudGroupRef.current.scale.setScalar(Math.max(0.001, k));
      cloudGroupRef.current.position.set(Math.sin(t * 0.35) * 0.04, (1 - k) * 0.16, 0);
    }
    if (particlesGroupRef.current) {
      const k = easeOutCubic(subRange(prog, 0.68, 1.0));
      particlesGroupRef.current.visible = k > 0.01;
      particlesGroupRef.current.scale.setScalar(Math.max(0.001, k));
    }

    if (canopyRef.current) {
      canopyRef.current.rotation.z = Math.sin(t * 1.1) * 0.022;
      canopyRef.current.rotation.x = Math.cos(t * 0.85) * 0.016;
    }
    if (swingRef.current) swingRef.current.rotation.x = Math.sin(t * 1.65) * 0.14;
    if (windmillRef.current) windmillRef.current.rotation.z = -t * 2.2;
    if (lanternLRef.current) lanternLRef.current.rotation.z = Math.sin(t * 1.5) * 0.08;
    if (lanternRRef.current) lanternRRef.current.rotation.z = Math.sin(t * 1.5 + 1.2) * 0.08;

    // Gentle twinkle on the winter fairy light bulbs
    for (let i = 0; i < winterFairyLights.bulbs.length; i++) {
      const m = fairyRefs.current[i];
      if (!m) continue;
      const pulse = 0.82 + 0.32 * Math.sin(t * 2.8 + winterFairyLights.bulbs[i].phase);
      m.scale.setScalar(pulse);
    }

    // Gentle rising chimney smoke puffs in autumn & winter
    for (let i = 0; i < 3; i++) {
      const sm = smokeRefs.current[i];
      if (!sm) continue;
      const u = (t * 0.35 + i / 3) % 1;
      sm.position.set(Math.sin(u * 4 + i) * 0.015, u * 0.16, 0);
      const s = 0.014 + u * 0.028;
      sm.scale.setScalar(s);
    }

    for (let i = 0; i < particles.length; i++) {
      const mesh = particleRefs.current[i];
      if (!mesh) continue;
      const p = particles[i];
      if (season === "summer") {
        mesh.position.set(
          p.x + Math.sin(t * 0.9 + p.phase) * 0.08,
          p.y + Math.sin(t * 1.4 + p.phase * 1.3) * 0.05,
          p.z + Math.cos(t * 0.8 + p.phase) * 0.08,
        );
        mesh.scale.setScalar(0.75 + 0.45 * Math.sin(t * 3.2 + p.phase));
      } else {
        const y = ((p.y - t * p.spd) % 0.9 + 0.9) % 0.9 + 0.03;
        mesh.position.set(p.x + Math.sin(t * 1.3 + p.phase) * 0.07, y, p.z + Math.cos(t * 1.1 + p.phase) * 0.07);
        mesh.rotation.set(t * 1.6 + p.phase, t * 1.2 + p.phase, t * 0.9);
      }
    }
  });

  return (
    <group>
      {/* ==================== 1. LAYER 1: 3D BACKGROUND HILLS, FENCE & STONES ==================== */}
      <group ref={bgStageRef}>
        {/* Sculpted 3D rolling hills strictly inside the |x|+|z| <= 0.64 page boundary */}
        <mesh geometry={SHARED_BLOB_GEO} position={[-0.12, 0.045, -0.26]} scale={[0.16, 0.13, 0.13]}>
          <BrightMat color={palette.hillBack} boost={0.34} />
        </mesh>
        <mesh geometry={SHARED_BLOB_GEO} position={[0.12, 0.04, -0.25]} scale={[0.15, 0.12, 0.13]}>
          <BrightMat color={palette.hillMid} boost={0.34} />
        </mesh>
        <mesh geometry={SHARED_BLOB_GEO} position={[0.0, 0.06, -0.36]} scale={[0.17, 0.18, 0.12]}>
          <BrightMat color={palette.hillSide} boost={0.32} />
        </mesh>
        {season === "winter" && (
          <mesh geometry={SHARED_BLOB_GEO} position={[0.0, 0.18, -0.36]} scale={[0.085, 0.055, 0.065]}>
            <BrightMat color="#ffffff" boost={0.48} />
          </mesh>
        )}

        {/* Cute 3D Wooden Fence along the back-left hillside */}
        <group position={[-0.24, 0, -0.14]} rotation={[0, 0.78, 0]}>
          {[-0.10, -0.03, 0.04, 0.11].map((fx, i) => (
            <mesh key={i} position={[fx, 0.045, 0]}>
              <boxGeometry args={[0.016, 0.09, 0.016]} />
              <BrightMat color={palette.fence} boost={0.30} />
            </mesh>
          ))}
          <mesh position={[0.005, 0.068, 0]}>
            <boxGeometry args={[0.25, 0.014, 0.012]} />
            <BrightMat color={palette.fence} boost={0.30} />
          </mesh>
          <mesh position={[0.005, 0.032, 0]}>
            <boxGeometry args={[0.25, 0.014, 0.012]} />
            <BrightMat color={palette.fence} boost={0.30} />
          </mesh>
        </group>

        {/* 3D Stepping Stones leading from front corner to the tree */}
        {[
          [0.02, 0.36, 0.042],
          [-0.03, 0.27, 0.038],
          [0.01, 0.19, 0.036],
        ].map(([sx, sz, sr], i) => (
          <mesh key={i} position={[sx, 0.008, sz]} scale={[1.15, 0.25, 0.9]}>
            <cylinderGeometry args={[sr, sr * 1.1, 0.04, 10]} />
            <BrightMat color={season === "winter" ? "#dbe8f6" : "#f5efe4"} boost={0.32} />
          </mesh>
        ))}
      </group>

      {/* ==================== LAYER 5A: FLOATING 3D CLOUDS & SUN / MOON ==================== */}
      <group ref={cloudGroupRef}>
        {season !== "winter" ? (
          <>
            <Cloud3D pos={[-0.18, 0.96, -0.28]} scale={0.85} color={season === "autumn" ? "#fff3e2" : "#ffffff"} />
            <Cloud3D pos={[0.22, 0.90, -0.26]} scale={0.72} color={season === "autumn" ? "#ffebd4" : "#ffffff"} />
            {/* Radiant 3D Sun */}
            <group position={[0.16, 1.02, -0.34]}>
              <mesh>
                <sphereGeometry args={[0.062, 16, 16]} />
                <meshBasicMaterial color={season === "autumn" ? "#ffb86c" : "#ffe98a"} />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.105, 16, 16]} />
                <meshBasicMaterial color={season === "autumn" ? "#ffae5c" : "#fff0a8"} transparent opacity={0.28} depthWrite={false} />
              </mesh>
            </group>
          </>
        ) : (
          /* Winter 3D Glowing Moon & 3D Stars */
          <group position={[-0.14, 0.98, -0.34]}>
            <mesh>
              <sphereGeometry args={[0.058, 16, 16]} />
              <meshBasicMaterial color="#fff9e2" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.105, 16, 16]} />
              <meshBasicMaterial color="#d8ecff" transparent opacity={0.32} depthWrite={false} />
            </mesh>
            {[
              [0.24, 0.04, 0.02],
              [0.34, -0.06, 0.05],
              [0.14, -0.08, 0.04],
              [-0.12, -0.05, 0.06],
            ].map(([sx, sy, sz], i) => (
              <mesh key={i} position={[sx, sy, sz]}>
                <octahedronGeometry args={[0.015, 0]} />
                <meshBasicMaterial color="#fff8d6" />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* ==================== 2. LAYER 2 & 3: CENTRAL 3D TREE & SPRING-BLOOM CANOPY ==================== */}
      <group ref={trunkRef} scale={[palette.scaleXZ, palette.scaleY, palette.scaleXZ]}>
        <mesh geometry={SHARED_BLOB_GEO} position={[0, 0.018, 0]} scale={[0.24, 0.05, 0.24]}>
          <BrightMat color={palette.mound} boost={0.32} />
        </mesh>

        <group>
          {branchGeos.map((geo, idx) => (
            <group key={idx}>
              <mesh geometry={geo}>
                <BrightMat color={palette.bark} boost={0.26} />
              </mesh>
              <mesh geometry={geo} scale={1.05} material={OUTLINE_MAT} />
            </group>
          ))}
        </group>

        <group ref={canopyRef}>
          {clusters.map((c, idx) => (
            <group
              key={idx}
              ref={(el) => {
                clusterRefs.current[idx] = el;
              }}
              position={c.pos}
              rotation={c.rot}
              scale={c.scale}
            >
              <mesh geometry={SHARED_BLOB_GEO}>
                <BrightMat color={c.color} boost={0.34} />
              </mesh>
              <mesh geometry={SHARED_BLOB_GEO} scale={1.045} material={OUTLINE_MAT} />
            </group>
          ))}

          <group ref={bloomExtrasRef}>
            {/* Summer golden fruits */}
            {season === "summer" &&
              [
                [-0.22, 0.49, 0.19],
                [0.24, 0.48, 0.18],
                [-0.08, 0.65, 0.17],
                [0.12, 0.67, 0.13],
              ].map((pos, i) => (
                <mesh key={i} position={pos as [number, number, number]}>
                  <sphereGeometry args={[0.022, 10, 10]} />
                  <BrightMat color="#ffe270" boost={0.42} />
                </mesh>
              ))}

            {/* Winter blooming 3D red plum blossoms nestled across the snowy canopy */}
            {season === "winter" &&
              winterPlumBlossoms.map((pb, i) => (
                <PlumBlossom3D key={`plum-${i}`} pos={pb.pos} rot={pb.rot} scale={pb.scale} color={pb.color} />
              ))}
          </group>
        </group>

        {/* Spring 3D rope swing */}
        {season === "spring" && (
          <group ref={swingRef} position={[0.20, 0.49, 0.09]}>
            <mesh position={[-0.04, -0.14, 0]}>
              <cylinderGeometry args={[0.003, 0.003, 0.28, 6]} />
              <meshBasicMaterial color={INK_COLOR} />
            </mesh>
            <mesh position={[0.04, -0.14, 0]}>
              <cylinderGeometry args={[0.003, 0.003, 0.28, 6]} />
              <meshBasicMaterial color={INK_COLOR} />
            </mesh>
            <mesh position={[0, -0.28, 0]}>
              <boxGeometry args={[0.105, 0.016, 0.048]} />
              <BrightMat color="#ecc094" boost={0.32} />
            </mesh>
          </group>
        )}
      </group>

      {/* ==================== 3. LAYER 4: SEASON-SPECIFIC 3D STORYBOOK PROPS ==================== */}
      <group ref={propsRef}>

      {/* SPRING PROPS: Spinning 3D Pinwheel Windmill + Colorful 3D Flower Field + Cute Mailbox */}
      {season === "spring" && (
        <>
          {/* Spinning 3D Windmill on the right slope */}
          <group position={[0.26, 0, 0.14]} rotation={[0, -0.5, 0]}>
            <mesh position={[0, 0.10, 0]}>
              <cylinderGeometry args={[0.008, 0.011, 0.20, 8]} />
              <BrightMat color="#e4c29a" boost={0.3} />
            </mesh>
            <group ref={windmillRef} position={[0, 0.19, 0.015]}>
              {[0, 1, 2, 3].map((k) => (
                <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
                  <mesh position={[0, 0.045, 0]}>
                    <boxGeometry args={[0.022, 0.085, 0.005]} />
                    <BrightMat color={k % 2 === 0 ? "#ffb8d0" : "#fff2b2"} boost={0.40} />
                  </mesh>
                </group>
              ))}
              <mesh>
                <sphereGeometry args={[0.014, 8, 8]} />
                <BrightMat color="#ff92b4" boost={0.35} />
              </mesh>
            </group>
          </group>

          {/* 3D Spring Flowers */}
          {springFlowers.map((fl, i) => (
            <group key={i} position={[fl.x, 0, fl.z]}>
              <mesh position={[0, fl.h / 2, 0]}>
                <cylinderGeometry args={[0.003, 0.004, fl.h, 5]} />
                <BrightMat color="#7ec97a" boost={0.32} />
              </mesh>
              <mesh position={[0, fl.h, 0]}>
                <sphereGeometry args={[0.014, 7, 7]} />
                <BrightMat color={fl.col} boost={0.42} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* SUMMER PROPS: 3D Lily-Pad Pond with Lotus + Shady Bench with Straw Hat & Lemonade */}
      {season === "summer" && (
        <>
          {/* 3D Pond on the right-front */}
          <group position={[0.24, 0.008, 0.18]}>
            <mesh scale={[1.25, 0.15, 0.95]}>
              <cylinderGeometry args={[0.14, 0.145, 0.06, 20]} />
              <BrightMat color="#8fd4f8" boost={0.40} />
            </mesh>
            {/* Stones rimming the pond */}
            {[
              [-0.14, 0.04],
              [-0.08, 0.11],
              [0.09, 0.10],
              [0.15, -0.02],
              [-0.11, -0.09],
            ].map(([rx, rz], i) => (
              <mesh key={i} geometry={SHARED_BLOB_GEO} position={[rx, 0.014, rz]} scale={[0.028, 0.018, 0.024]}>
                <BrightMat color="#d9d5cc" boost={0.30} />
              </mesh>
            ))}
            {/* Floating 3D Lily Pads & Pink Lotus */}
            <mesh position={[-0.03, 0.012, 0.02]}>
              <cylinderGeometry args={[0.038, 0.038, 0.006, 12]} />
              <BrightMat color="#78cc78" boost={0.35} />
            </mesh>
            <mesh position={[0.05, 0.012, -0.03]}>
              <cylinderGeometry args={[0.028, 0.028, 0.006, 12]} />
              <BrightMat color="#8ad986" boost={0.35} />
            </mesh>
            <mesh position={[-0.025, 0.028, 0.02]}>
              <coneGeometry args={[0.022, 0.026, 6]} />
              <BrightMat color="#ffb8d0" boost={0.45} />
            </mesh>
          </group>

          {/* 3D Wooden Park Bench + Straw Sunhat on the left-front */}
          <group position={[-0.24, 0, 0.18]} rotation={[0, 0.65, 0]}>
            <mesh position={[0, 0.055, 0]}>
              <boxGeometry args={[0.18, 0.016, 0.065]} />
              <BrightMat color="#ebc294" boost={0.32} />
            </mesh>
            <mesh position={[0, 0.105, -0.028]}>
              <boxGeometry args={[0.18, 0.045, 0.012]} />
              <BrightMat color="#ebc294" boost={0.32} />
            </mesh>
            {[-0.072, 0.072].map((lx, i) => (
              <mesh key={i} position={[lx, 0.028, 0]}>
                <boxGeometry args={[0.016, 0.056, 0.055]} />
                <BrightMat color="#cfa072" boost={0.28} />
              </mesh>
            ))}
            {/* 3D Straw Hat */}
            <mesh position={[-0.02, 0.068, 0.005]}>
              <cylinderGeometry args={[0.042, 0.045, 0.008, 14]} />
              <BrightMat color="#ffe69e" boost={0.42} />
            </mesh>
            <mesh position={[-0.02, 0.085, 0.005]}>
              <cylinderGeometry args={[0.022, 0.026, 0.028, 12]} />
              <BrightMat color="#ffe69e" boost={0.42} />
            </mesh>
          </group>
        </>
      )}

      {/* AUTUMN PROPS: Cozy 3D Cottage with Rising Chimney Smoke + Pumpkin Patch + Leaf Carpet */}
      {season === "autumn" && (
        <>
          <Cottage3D pos={[0.20, 0.03, -0.18]} rotY={-0.65} snowy={false} />
          {/* Rising chimney smoke */}
          <group position={[0.23, 0.24, -0.17]}>
            {[0, 1, 2].map((i) => (
              <mesh
                key={i}
                ref={(el) => {
                  smokeRefs.current[i] = el;
                }}
                geometry={SHARED_BLOB_GEO}
              >
                <BrightMat color="#fff8ee" boost={0.5} opacity={0.65} />
              </mesh>
            ))}
          </group>

          {/* 3D Harvest Pumpkins */}
          {[
            [-0.22, 0.032, 0.18, 0.042, "#ff9147"],
            [-0.16, 0.024, 0.23, 0.032, "#ffa84c"],
            [-0.26, 0.022, 0.24, 0.028, "#f57c42"],
          ].map(([px, py, pz, pr, pcol], i) => (
            <group key={i} position={[px as number, py as number, pz as number]}>
              <mesh scale={[1.2, 0.85, 1.2]}>
                <sphereGeometry args={[pr as number, 12, 10]} />
                <BrightMat color={pcol as string} boost={0.35} />
              </mesh>
              <mesh position={[0, (pr as number) * 0.9, 0]}>
                <cylinderGeometry args={[0.004, 0.006, 0.022, 6]} />
                <BrightMat color="#7d9c58" boost={0.3} />
              </mesh>
            </group>
          ))}

          {/* 3D Fallen leaf carpet */}
          {autumnPile.map((leaf, i) => (
            <mesh key={i} position={leaf.pos} rotation={leaf.rot} scale={leaf.scale}>
              <cylinderGeometry args={[1, 1, 1, 6]} />
              <BrightMat color={leaf.color} boost={0.36} />
            </mesh>
          ))}
        </>
      )}

      {/* WINTER PROPS: Snowy Cottage + Glowing Tree Lanterns + 3D Snowman + Mini Snow Pines */}
      {season === "winter" && (
        <>
          <Cottage3D pos={[0.20, 0.03, -0.18]} rotY={-0.65} snowy={true} />
          <MiniPine3D pos={[-0.22, 0.02, -0.16]} scale={0.98} />
          <MiniPine3D pos={[0.28, 0.01, -0.02]} scale={0.80} />

          {/* 3D Cute Snowman with Red Scarf & Top Hat */}
          <group position={[-0.23, 0, 0.19]} rotation={[0, 0.55, 0]}>
            <mesh position={[0, 0.048, 0]}>
              <sphereGeometry args={[0.055, 14, 14]} />
              <BrightMat color="#ffffff" boost={0.42} />
            </mesh>
            <mesh position={[0, 0.118, 0]}>
              <sphereGeometry args={[0.038, 14, 14]} />
              <BrightMat color="#ffffff" boost={0.42} />
            </mesh>
            {/* Red scarf */}
            <mesh position={[0, 0.088, 0]}>
              <cylinderGeometry args={[0.036, 0.040, 0.016, 12]} />
              <BrightMat color="#f57878" boost={0.35} />
            </mesh>
            {/* Carrot nose */}
            <mesh position={[0, 0.118, 0.042]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.007, 0.028, 7]} />
              <BrightMat color="#ff9442" boost={0.4} />
            </mesh>
            {/* Cozy top hat */}
            <mesh position={[0, 0.152, 0]}>
              <cylinderGeometry args={[0.038, 0.038, 0.008, 12]} />
              <BrightMat color="#4c5678" boost={0.28} />
            </mesh>
            <mesh position={[0, 0.172, 0]}>
              <cylinderGeometry args={[0.024, 0.026, 0.038, 12]} />
              <BrightMat color="#4c5678" boost={0.28} />
            </mesh>
          </group>

          {/* Frozen icy pond */}
          <mesh position={[0.24, 0.006, 0.18]} scale={[1.2, 0.12, 0.9]}>
            <cylinderGeometry args={[0.12, 0.12, 0.05, 18]} />
            <BrightMat color="#d2ebff" boost={0.48} />
          </mesh>

          {/* Two warm glowing 3D hanging lanterns */}
          {[
            { ref: lanternLRef, pos: [-0.21, 0.50, 0.10] as [number, number, number] },
            { ref: lanternRRef, pos: [0.22, 0.50, 0.10] as [number, number, number] },
          ].map((item, idx) => (
            <group key={idx} ref={item.ref} position={item.pos}>
              <mesh position={[0, -0.05, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.10, 6]} />
                <meshBasicMaterial color={INK_COLOR} />
              </mesh>
              <mesh position={[0, -0.115, 0]}>
                <cylinderGeometry args={[0.024, 0.02, 0.055, 8]} />
                <meshBasicMaterial color="#ffea9f" />
              </mesh>
              <mesh position={[0, -0.115, 0]}>
                <sphereGeometry args={[0.072, 12, 12]} />
                <meshBasicMaterial color="#ffd97d" transparent opacity={0.34} depthWrite={false} />
              </mesh>
              <pointLight position={[0, -0.12, 0]} color="#ffd578" intensity={0.8} distance={1.4} decay={2} />
            </group>
          ))}

          {/* Draped 3D fairy string lights across the winter branches */}
          <group>
            {winterFairyLights.wireGeos.map((geo, i) => (
              <mesh key={`w-${i}`} geometry={geo}>
                <meshBasicMaterial color={INK_COLOR} />
              </mesh>
            ))}
            {winterFairyLights.bulbs.map((b, i) => (
              <group key={`b-${i}`} position={b.pos}>
                <mesh
                  ref={(el) => {
                    fairyRefs.current[i] = el;
                  }}
                >
                  <sphereGeometry args={[0.011, 8, 8]} />
                  <meshBasicMaterial color={b.color} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.028, 8, 8]} />
                  <meshBasicMaterial color={b.color} transparent opacity={0.28} depthWrite={false} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Crimson winter holly berry clusters & evergreen leaves */}
          {winterOrnaments.berries.map(([bx, by, bz], i) => (
            <group key={`berry-${i}`} position={[bx, by, bz]}>
              <mesh position={[0, 0.008, 0]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <BrightMat color="#f05a5a" boost={0.44} />
              </mesh>
              <mesh position={[0.012, 0.002, 0.008]}>
                <sphereGeometry args={[0.011, 8, 8]} />
                <BrightMat color="#ff7266" boost={0.44} />
              </mesh>
              <mesh position={[-0.011, 0.003, 0.006]}>
                <sphereGeometry args={[0.010, 8, 8]} />
                <BrightMat color="#e84c52" boost={0.44} />
              </mesh>
              {/* Two tiny evergreen holly leaves */}
              <mesh position={[-0.016, 0.014, -0.005]} rotation={[0.3, 0.4, 0.5]} scale={[1.4, 0.35, 0.7]}>
                <sphereGeometry args={[0.015, 6, 6]} />
                <BrightMat color="#5da37a" boost={0.34} />
              </mesh>
              <mesh position={[0.016, 0.014, -0.004]} rotation={[0.3, -0.4, -0.5]} scale={[1.4, 0.35, 0.7]}>
                <sphereGeometry args={[0.015, 6, 6]} />
                <BrightMat color="#6bb586" boost={0.34} />
              </mesh>
            </group>
          ))}

          {/* Glistening crystal 3D icicles hanging under the branches */}
          {winterOrnaments.icicles.map(([ix, iy, iz, len], i) => (
            <mesh key={`ice-${i}`} position={[ix, iy - len * 0.5, iz]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.009, len, 6]} />
              <BrightMat color="#d9f0ff" boost={0.55} opacity={0.86} />
            </mesh>
          ))}

          {/* Cozy snow-topped wooden birdhouse */}
          <Birdhouse3D pos={[0.13, 0.39, 0.08]} rotY={-0.35} />
        </>
      )}
      </group>

      {/* ==================== 4. LAYER 5B: REAL-TIME 3D SEASONAL PARTICLES ==================== */}
      <group ref={particlesGroupRef}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            particleRefs.current[i] = el;
          }}
          position={[p.x, p.y, p.z]}
        >
          {/* Winter particles: snowflakes mixed with a few drifting crimson plum petals */}
          {season === "winter" ? (
            <sphereGeometry args={[p.size, 6, 6]} />
          ) : season === "summer" ? (
            <sphereGeometry args={[p.size, 6, 6]} />
          ) : (
            <boxGeometry args={[p.size * 1.4, p.size * 0.25, p.size]} />
          )}
          <meshBasicMaterial color={season === "winter" && i % 6 === 0 ? "#f25c6e" : p.color} transparent opacity={0.95} />
        </mesh>
      ))}
      </group>
    </group>
  );
}
