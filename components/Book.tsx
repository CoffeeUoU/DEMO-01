"use client";

import { useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { H, L, N, dirOf, floorApex, focusAngle, focusOf, logicalOf, normalOf, pageAngles, roomOpenness, smooth } from "@/lib/fold";
import { makePaperMaterial, INK } from "@/lib/paperMaterial";
import { ROOMS } from "@/lib/rooms";
import { book } from "@/lib/store";
import type { BookTextures } from "@/lib/textures";
import SeasonTree3D, { type Season } from "./SeasonTree3D";
import SeasonGroundCover3D from "./SeasonGroundCover3D";
import SeasonWall3D from "./SeasonWall3D";

const PAGE_GAP = 0.014; // thickness between pages when the book is shut
const INK_HEX = `#${INK.getHexString()}`;

const VEIL_COLORS: Record<Season, { mist: string; spark: string }> = {
  spring: { mist: "#ffe4f0", spark: "#ffc4dc" },
  summer: { mist: "#e4fff2", spark: "#a6f0c6" },
  autumn: { mist: "#fff0d6", spark: "#ffcf82" },
  winter: { mist: "#e6f2ff", spark: "#c2dcff" },
};

type CachedFadeItem = {
  mesh: THREE.Mesh;
  mat: THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean; side: THREE.Side };
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
  isBackOutline: boolean;
};

/**
 * Smoothly modulates opacity across every mesh inside a 3D group using a cached material list
 * (zero per-frame scene-graph traversal) while preserving each material's original opacity /
 * transparent / depthWrite when alpha reaches 1.
 * BackSide ink-outline shells are suppressed until alpha > 0.86 so dark hulls never bleed through!
 */
function applyGroupOpacity(root: THREE.Object3D, alpha: number) {
  const prev = root.userData.__lastAlpha as number | undefined;
  if (prev !== undefined && Math.abs(prev - alpha) < 0.008) return;
  root.userData.__lastAlpha = alpha;
  const full = alpha >= 0.99;
  const outlineAlpha = smooth((alpha - 0.86) / 0.14);

  let items = root.userData.__fadeItems as CachedFadeItem[] | undefined;
  if (!items) {
    items = [];
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const raw of mats) {
        const mat = raw as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean; side: THREE.Side };
        items!.push({
          mesh,
          mat,
          baseOpacity: mat.opacity,
          baseTransparent: mat.transparent,
          baseDepthWrite: mat.depthWrite,
          isBackOutline: mat.side === THREE.BackSide,
        });
      }
    });
    root.userData.__fadeItems = items;
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const m = it.mat;
    if (full) {
      m.opacity = it.baseOpacity;
      m.transparent = it.baseTransparent;
      m.depthWrite = it.baseDepthWrite;
      if (it.isBackOutline) it.mesh.visible = true;
    } else if (it.isBackOutline) {
      it.mesh.visible = outlineAlpha > 0.02;
      m.transparent = true;
      m.opacity = it.baseOpacity * outlineAlpha;
      m.depthWrite = false;
    } else {
      m.transparent = true;
      m.opacity = it.baseOpacity * alpha;
      m.depthWrite = alpha > 0.55 ? it.baseDepthWrite : false;
    }
  }
}

/** Dreamy seasonal mist-shimmer & rising stardust halo that blooms while a season wakes up */
function TransitionVeil3D({
  season,
  revealRef,
}: {
  season: Season;
  revealRef: { current: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const motesRef = useRef<(THREE.Mesh | null)[]>([]);
  const colors = VEIL_COLORS[season];

  const motes = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.25;
        const r = 0.14 + (i % 5) * 0.075;
        const h = 0.08 + (i % 4) * 0.14;
        const s = 0.011 + (i % 3) * 0.005;
        return { a, r, h, s, speed: 0.7 + (i % 4) * 0.22 };
      }),
    [],
  );

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const r = revealRef.current;
    const veil = r > 0.01 && r < 0.99 ? Math.sin(r * Math.PI) : 0;
    g.visible = veil > 0.01;
    if (!g.visible) return;

    const t = clock.elapsedTime;
    if (ringMatRef.current) {
      ringMatRef.current.opacity = veil * 0.42;
    }
    g.scale.setScalar(0.84 + 0.28 * r);
    for (let i = 0; i < motes.length; i++) {
      const m = motesRef.current[i];
      if (!m) continue;
      const d = motes[i];
      const ang = d.a + t * 0.45 * d.speed + r * 0.9;
      m.position.set(Math.cos(ang) * d.r, d.h + r * 0.32 + Math.sin(t * 2 + i) * 0.02, Math.sin(ang) * d.r);
      const sc = d.s * (0.55 + 0.75 * veil);
      m.scale.setScalar(sc);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = veil * 0.82;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.08, 0.42, 32]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={colors.mist}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {motes.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            motesRef.current[i] = el;
          }}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={colors.spark} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Hand-wobbled closed outline in a page's local XY plane. */
function wobbleRect(seed: number): THREE.Vector3[] {
  const corners = [
    [0, 0],
    [L, 0],
    [L, H],
    [0, H],
    [0, 0],
  ];
  const out: THREE.Vector3[] = [];
  for (let s = 0; s < 4; s++) {
    const [x1, y1] = corners[s];
    const [x2, y2] = corners[s + 1];
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const o = 0.004 * (Math.sin(seed * 3.1 + (s * 16 + j) * 0.7) * 0.6 + Math.sin(seed * 1.7 + (s * 16 + j) * 1.9) * 0.4);
      out.push(new THREE.Vector3(x1 + (x2 - x1) * t + nx * o, y1 + (y2 - y1) * t + ny * o, 0));
    }
  }
  out.push(out[0].clone());
  return out;
}

const EDGE_STEPS = 12;
/** Writes a wobbly segment a→b into arr at offset (EDGE_STEPS+1 points). */
function writeEdge(arr: Float32Array, offset: number, a: number[], b: number[], seed: number) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  for (let j = 0; j <= EDGE_STEPS; j++) {
    const t = j / EDGE_STEPS;
    const o = 0.005 * (Math.sin(seed + j * 0.9) * 0.6 + Math.sin(seed * 2.3 + j * 2.1) * 0.4);
    const i = (offset + j) * 3;
    arr[i] = a[0] + (b[0] - a[0]) * t + px * o;
    arr[i + 1] = a[1] + (b[1] - a[1]) * t + 0.002;
    arr[i + 2] = a[2] + (b[2] - a[2]) * t + pz * o;
  }
}

type Rect = [number, number, number, number];
type Hot = { spot: string; pos: [number, number, number]; w: number; h: number };

/**
 * An invisible, clickable patch over something drawn in a room (the mirror, the diary...).
 * It breathes faintly while its room is in front so it can be found, and tints on hover.
 */
function Hotspot({ hot, room, onPick }: { hot: Hot; room: number; onPick: (spot: string) => void }) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  const hover = useRef(false);
  const live = () => book.open > 0.97 && focusOf(room, book.f) > 0.97 && !book.dragging;
  useFrame(({ clock }) => {
    const on = live();
    const want = !on ? 0 : hover.current ? 0.16 : 0.035 + 0.035 * Math.sin(clock.elapsedTime * 2.2);
    mat.opacity += (want - mat.opacity) * 0.15;
  });
  const setHover = (v: boolean) => {
    hover.current = v && live();
    document.body.style.cursor = hover.current ? "pointer" : "";
  };
  return (
    <mesh
      position={hot.pos}
      material={mat}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (!live() || e.delta > 6) return;
        setHover(false);
        const w = new THREE.Vector3();
        e.object.getWorldPosition(w);
        book.zoomAt = [w.x, w.y, w.z];
        onPick(hot.spot);
      }}
    >
      <planeGeometry args={[hot.w, hot.h]} />
    </mesh>
  );
}

const marksOf = (t: THREE.Texture): Record<string, Rect> => (t.userData.marks as Record<string, Rect>) ?? {};

export default function Book({ tex, onSpot }: { tex: BookTextures; onSpot: (room: number, spot: string) => void }) {
  const { camera, size } = useThree();

  // ---- static pieces ------------------------------------------------------
  const pageGeo = useMemo(() => {
    const front = new THREE.PlaneGeometry(L, H).translate(L / 2, H / 2, 0);
    // back face: rotated so the spine sits at u = 1 (no mirrored drawings)
    const back = new THREE.PlaneGeometry(L, H).rotateY(Math.PI).translate(L / 2, H / 2, 0);
    return { front, back };
  }, []);

  // Page k front = right wall of physical room k (or the front cover for k = N).
  // Page k back  = left wall of physical room k-1 (or the back cover for k = 0).
  const pageMats = useMemo(
    () =>
      Array.from({ length: N + 1 }, (_, k) => ({
        front: makePaperMaterial(k === N ? tex.front : tex.rooms[logicalOf(k)].right, { seed: k * 2, flat: k === N }),
        back: makePaperMaterial(k === 0 ? tex.back : tex.rooms[logicalOf(k - 1)].left, { seed: k * 2 + 1, flat: k === 0 }),
      })),
    [tex],
  );

  const floors = useMemo(
    () =>
      Array.from({ length: N }, (_, p) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18), 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2));
        const mat = makePaperMaterial(tex.rooms[logicalOf(p)].floor, { side: THREE.DoubleSide, seed: 40 + p });
        return { geo, mat };
      }),
    [tex],
  );

  const popups = useMemo(
    () =>
      Array.from({ length: N }, (_, p) => {
        const li = logicalOf(p);
        return ROOMS[li].popups.map((spec, j) => ({
          spec,
          geo: new THREE.PlaneGeometry(spec.size, spec.size).translate(0, spec.size / 2, 0),
          mat: makePaperMaterial(tex.rooms[li].popups[j], { side: THREE.DoubleSide, blankBack: true, seed: 60 + p * 4 + j, flat: 0.85, transparent: true }),
        }));
      }),
    [tex],
  );

  // Clickable spots: on the right wall (page p front), the left wall (page p+1 back) and pop-up cards.
  const hots = useMemo(() => {
    const front: { room: number; hot: Hot }[][] = Array.from({ length: N + 1 }, () => []);
    const back: { room: number; hot: Hot }[][] = Array.from({ length: N + 1 }, () => []);
    const cards: Hot[][][] = Array.from({ length: N }, () => []);
    for (let p = 0; p < N; p++) {
      const r = tex.rooms[logicalOf(p)];
      for (const [spot, [x0, y0, x1, y1]] of Object.entries(marksOf(r.right)))
        front[p].push({ room: p, hot: { spot, pos: [((x0 + x1) / 2) * L, H * (1 - (y0 + y1) / 2), 0.004], w: (x1 - x0) * L, h: (y1 - y0) * H } });
      for (const [spot, [x0, y0, x1, y1]] of Object.entries(marksOf(r.left)))
        back[p + 1].push({ room: p, hot: { spot, pos: [L * (1 - (x0 + x1) / 2), H * (1 - (y0 + y1) / 2), -0.004], w: (x1 - x0) * L, h: (y1 - y0) * H } });
      cards[p] = r.popups.map((pt, j) => {
        const size = ROOMS[logicalOf(p)].popups[j].size;
        return Object.entries(marksOf(pt)).map(([spot, [x0, y0, x1, y1]]) => ({
          spot,
          pos: [((x0 + x1) / 2 - 0.5) * size, (1 - (y0 + y1) / 2) * size, 0.006] as [number, number, number],
          w: (x1 - x0) * size,
          h: (y1 - y0) * size,
        }));
      });
    }
    return { front, back, cards };
  }, [tex]);
  const pick = (p: number) => (spot: string) => onSpot(logicalOf(p), spot);

  const outlines = useMemo(() => Array.from({ length: N + 1 }, (_, k) => wobbleRect(k + 1)), []);
  const floorLinePts = useMemo(() => Array.from({ length: N }, () => Array.from({ length: (EDGE_STEPS + 1) * 3 }, () => new THREE.Vector3())), []);
  const edgeBuf = useMemo(() => new Float32Array((EDGE_STEPS + 1) * 3 * 3), []);

  // ---- refs ---------------------------------------------------------------
  const pageRefs = useRef<(THREE.Group | null)[]>([]);
  const floorLineRefs = useRef<(Line2 | null)[]>([]);
  const outlineRefs = useRef<(Line2 | null)[]>([]);
  const popRefs = useRef<{ outer: THREE.Group | null; hinge: THREE.Group | null }[][]>(Array.from({ length: N }, () => []));
  const treeRefs = useRef<(THREE.Group | null)[]>([]);
  const veilRefs = useRef<(THREE.Group | null)[]>([]);
  const groundPosRefs = useRef<(THREE.Group | null)[]>([]);
  const groundNegRefs = useRef<(THREE.Group | null)[]>([]);
  const wallLeftRefs = useRef<(THREE.Group | null)[]>([]);
  const wallRightRefs = useRef<(THREE.Group | null)[]>([]);
  const wallClipPlanes = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        left: [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 2)],
        right: [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(1, 0, 0), 2)],
      })),
    [],
  );
  const originZero = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const creaseNormal = useMemo(() => new THREE.Vector3(), []);
  const roomRevealRefs = useRef<{ current: number }[]>(Array.from({ length: N }, () => ({ current: 0 })));
  const treeProgressRefs = useRef<{ current: number }[]>(Array.from({ length: N }, () => ({ current: 0 })));
  const floorFlatRefs = useRef<{ current: boolean }[]>(Array.from({ length: N }, () => ({ current: false })));
  const target = useMemo(() => new THREE.Vector3(), []);
  // Scratch vectors & matrix for exact origami floor-triangle basis computation (zero per-frame GC)
  const origamiScratch = useMemo(
    () => ({
      vP: new THREE.Vector3(),
      vA: new THREE.Vector3(),
      vB: new THREE.Vector3(),
      uZ: new THREE.Vector3(),
      uX: new THREE.Vector3(),
      uY: new THREE.Vector3(),
      mat: new THREE.Matrix4(),
    }),
    [],
  );

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    if (!book.dragging) book.f += (book.target - book.f) * (1 - Math.exp(-dt * 3.2));
    book.open += (book.openTarget - book.open) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(book.openTarget - book.open) < 1e-4) book.open = book.openTarget;

    const f = book.f;
    const e = smooth(book.open);
    const phi = pageAngles(f, book.open);

    // pages
    for (let k = 0; k <= N; k++) {
      const g = pageRefs.current[k];
      if (!g) continue;
      const n = normalOf(phi[k]);
      const off = (k - N / 2) * PAGE_GAP * (1 - e);
      g.rotation.y = -phi[k];
      g.position.set(n[0] * off, 0, n[2] * off);
      const m = pageMats[k];
      const rf = k === N ? 1 : focusOf(k, f) * e;
      const rb = k === 0 ? 1 : focusOf(k - 1, f) * e;
      m.front.uniforms.uReveal.value = rf;
      m.back.uniforms.uReveal.value = rb;
      m.front.uniforms.uInkAmt.value = k === N ? 1 : 0.55 + 0.45 * rf;
      m.back.uniforms.uInkAmt.value = k === 0 ? 1 : 0.55 + 0.45 * rb;
    }

    // floors + pop-ups
    for (let p = 0; p < N; p++) {
      const a = phi[p];
      const b = phi[p + 1];
      const A = dirOf(a).map((v) => v * L);
      const B = dirOf(b).map((v) => v * L);
      const P = floorApex(a, b);
      const O = [0, 0, 0];
      const pos = floors[p].geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      [O, A, P, O, P, B].forEach((v, i) => {
        arr[i * 3] = v[0];
        arr[i * 3 + 1] = v[1] + 0.0005;
        arr[i * 3 + 2] = v[2];
      });
      pos.needsUpdate = true;
      floors[p].geo.computeVertexNormals();
      floors[p].geo.computeBoundingSphere();
      const fr = focusOf(p, f) * e;
      floors[p].mat.uniforms.uReveal.value = fr;
      floors[p].mat.uniforms.uInkAmt.value = 0.5 + 0.5 * fr;

      const line = floorLineRefs.current[p];
      if (line) {
        writeEdge(edgeBuf, 0, A, P, p * 3 + 1);
        writeEdge(edgeBuf, EDGE_STEPS + 1, P, B, p * 3 + 2);
        writeEdge(edgeBuf, (EDGE_STEPS + 1) * 2, O, P, p * 3 + 3);
        line.geometry.setPositions(edgeBuf);
        line.material.opacity = smooth((book.open - 0.05) / 0.25);
        line.visible = line.material.opacity > 0.01;
      }

      const open = roomOpenness(phi, p);
      // Pop-ups are drawn for the fully open room seen head-on, so they only appear once the
      // room has settled at a right angle and fade out as soon as it starts to fold.
      const rise = smooth((open - 0.965) / 0.035) * smooth((book.open - 0.96) / 0.04);
      const mid = (a + b) / 2;
      const dA = dirOf(a);
      const dB = dirOf(b);
      popups[p].forEach((pu, j) => {
        const r = popRefs.current[p][j];
        if (!r?.outer || !r.hinge) return;
        const vis = smooth((rise - j * 0.3) / (1 - j * 0.3 + 1e-3));
        r.outer.visible = vis > 0.01;
        const [s, t] = pu.spec.at;
        r.outer.position.set((dA[0] * s + dB[0] * t) * L, 0.001, (dA[2] * s + dB[2] * t) * L);
        r.outer.rotation.y = Math.PI / 2 - mid;
        // fade in one layer after another with a small lift
        r.hinge.scale.y = 0.9 + 0.1 * vis;
        pu.mat.uniforms.uOpacity.value = vis;
        pu.mat.uniforms.uReveal.value = fr;
      });

      // Dreamy staggered season reveal ("Mist-Veil Awakening"):
      // The paper room opens cleanly first; once open > 0.80, the new season emerges gently from mist
      // in 3 staggered waves (1. Ground & hills → 2. Wall mountains → 3. Central tree & roots),
      // and fades cleanly back into paper before the floor lifts during page turns!
      const focus = focusOf(p, f);
      const wantReveal = open > 0.80 && book.open > 0.84 && focus > 0.52 ? 1 : 0;
      const curRev = roomRevealRefs.current[p].current;
      const revRate = wantReveal > curRev ? 2.15 : 6.8;
      let rev = curRev + (wantReveal - curRev) * (1 - Math.exp(-dt * revRate));
      if (Math.abs(wantReveal - rev) < 0.002) rev = wantReveal;
      roomRevealRefs.current[p].current = rev;

      const groundAlpha = smooth(rev / 0.56);
      const treeAlpha = smooth((rev - 0.18) / 0.74);

      // Compute exact origami floor-wing normals (uY_A for right wing O-A-P, uY_B for left wing O-P-B)
      // Used both by SeasonGroundCover3D and as exact WebGL clipping planes for SeasonWall3D!
      const { vP, vA, vB, uZ, uX, uY, mat } = origamiScratch;
      vP.set(P[0], P[1], P[2]);
      vA.set(A[0], A[1], A[2]);
      vB.set(B[0], B[1], B[2]);
      uZ.copy(vP).normalize();

      // Wing A (right wall O-A-P) upward normal
      uX.copy(vA).addScaledVector(vP, -0.5).normalize();
      uY.crossVectors(uZ, uX).normalize();
      const clipSet = wallClipPlanes[p];
      clipSet.right[0].setFromNormalAndCoplanarPoint(uY, originZero);
      clipSet.right[0].constant -= 0.001;

      const veil = veilRefs.current[p];
      if (veil) {
        veil.position.set(P[0] * 0.48, P[1] * 0.48 + 0.004, P[2] * 0.48);
        veil.rotation.y = Math.PI / 2 - mid;
      }

      const tree = treeRefs.current[p];
      if (tree) {
        treeProgressRefs.current[p].current = treeAlpha;
        // Trigger gentle root extension once the floor is flat and the tree begins blooming
        floorFlatRefs.current[p].current = open >= 0.96 && book.open >= 0.94 && focus > 0.5 && rev > 0.35;

        const active = treeAlpha > 0.01;
        tree.visible = active;
        if (active) {
          tree.position.set(P[0] * 0.48, P[1] * 0.48 + 0.002, P[2] * 0.48);
          tree.rotation.y = Math.PI / 2 - mid + (1 - treeAlpha) * 0.14;
          const bloomScale = 0.76 + 0.24 * treeAlpha;
          const squeezeX = Math.max(0.18, Math.pow(open, 2.0));
          tree.scale.set(squeezeX * bloomScale, bloomScale, bloomScale);
          applyGroupOpacity(tree, treeAlpha);
        }
      }

      // Rigid origami floor-hinge transform for SeasonGroundCover3D with dreamy wave-1 fade & rise
      const gPos = groundPosRefs.current[p];
      const gNeg = groundNegRefs.current[p];
      const showGround = groundAlpha > 0.01;
      if (gPos && gNeg) {
        gPos.visible = showGround;
        gNeg.visible = showGround;
        if (showGround) {
          const gLift = 0.08 + 0.92 * groundAlpha;
          // Wing A (x >= 0): triangle O-A-P (uX, uY, uZ already computed above)
          mat.makeBasis(uX, uY, uZ);
          gPos.position.set(P[0] * 0.48 + uY.x * 0.002, P[1] * 0.48 + uY.y * 0.002, P[2] * 0.48 + uY.z * 0.002);
          gPos.quaternion.setFromRotationMatrix(mat);
          gPos.scale.set(1, gLift, 1);
          applyGroupOpacity(gPos, groundAlpha);
        }
      }

      // Wing B (left wall O-P-B) upward normal
      uX.copy(vP).multiplyScalar(0.5).sub(vB).normalize();
      uY.crossVectors(uZ, uX).normalize();
      clipSet.left[0].setFromNormalAndCoplanarPoint(uY, originZero);
      clipSet.left[0].constant -= 0.001;

      if (gPos && gNeg && showGround) {
        const gLift = 0.08 + 0.92 * groundAlpha;
        mat.makeBasis(uX, uY, uZ);
        gNeg.position.set(P[0] * 0.48 + uY.x * 0.002, P[1] * 0.48 + uY.y * 0.002, P[2] * 0.48 + uY.z * 0.002);
        gNeg.quaternion.setFromRotationMatrix(mat);
        gNeg.scale.set(1, gLift, 1);
        applyGroupOpacity(gNeg, groundAlpha);
      }

      // Diagonal crease guard planes: keep each wall's fixed-parameter mountain strictly inside its own
      // wall-floor wedge while folding, then smoothly release as the floor settles flat at 90°!
      const pXzLen = Math.hypot(P[0], P[2]) || 1;
      const creaseSlack = smooth((open - 0.88) / 0.12) * 2.0;
      creaseNormal.set(P[2] / pXzLen, 0, -P[0] / pXzLen);
      clipSet.right[1].set(creaseNormal, creaseSlack);
      creaseNormal.set(-P[2] / pXzLen, 0, P[0] / pXzLen);
      clipSet.left[1].set(creaseNormal, creaseSlack);

      // 3D Low-Poly Wall Mountains keep 100% FIXED user-set parameters (scale 1,1,1) and reveal
      // organically from the top down as the wall-to-floor angle opens wider — ZERO floor clipping!
      const wL = wallLeftRefs.current[p];
      const wR = wallRightRefs.current[p];
      if (wL || wR) {
        const wallOpenAlpha =
          smooth((open - 0.18) / 0.34) * smooth((book.open - 0.22) / 0.35) * smooth((focus - 0.04) / 0.32);
        const showWall = wallOpenAlpha > 0.01;
        if (wL) {
          wL.visible = showWall;
          if (showWall) {
            wL.scale.set(1, 1, 1);
            applyGroupOpacity(wL, wallOpenAlpha);
          }
        }
        if (wR) {
          wR.visible = showWall;
          if (showWall) {
            wR.scale.set(1, 1, 1);
            applyGroupOpacity(wR, wallOpenAlpha);
          }
        }
      }
    }

    // camera: front view of the cover when shut, looking into the focused room when open
    book.roam += (book.roamTarget - book.roam) * (1 - Math.exp(-dt * 4.2));
    const rm = smooth(book.roam) * e;
    const gF = focusAngle(phi, f);
    const yaw = Math.PI / 2 + (gF - Math.PI / 2) * e;
    const pitch = THREE.MathUtils.degToRad(8 + 24 * e - 11 * rm);
    const dF = dirOf(gF);
    target.set(L / 2 + (dF[0] * 0.45 - L / 2) * e, H / 2 + (0.5 - 0.10 * rm - H / 2) * e, dF[2] * 0.45 * e);
    // moving in on a journal spot
    book.zoom += (book.zoomTarget - book.zoom) * (1 - Math.exp(-dt * 6));
    const zm = smooth(book.zoom);
    target.x += (book.zoomAt[0] - target.x) * zm;
    target.y += (book.zoomAt[1] - target.y) * zm;
    target.z += (book.zoomAt[2] - target.z) * zm;
    camera.position.set(target.x + Math.cos(yaw) * Math.cos(pitch) * 10, target.y + Math.sin(pitch) * 10, target.z + Math.sin(yaw) * Math.cos(pitch) * 10);
    camera.lookAt(target);
    // Responsive framing across mobile portrait, tablet, short landscape, and desktop
    const isMobile = size.width < 640;
    const isTablet = size.width >= 640 && size.width < 1024;
    const isShort = size.height < 540;
    if (isMobile) {
      // Nudge slightly up in screen space on portrait phones to leave comfortable breathing room for bottom UI
      target.y -= 0.08 * e * (1 - zm);
    }
    const viewH = isShort ? 1.62 + 0.96 * e : isMobile ? 1.78 + 1.05 * e : 1.7 + 1.0 * e;
    const viewW = isMobile ? 1.45 + 0.92 * e : isTablet ? 1.75 + 1.10 * e : 1.9 + 1.2 * e;
    const ortho = camera as THREE.OrthographicCamera;
    const roamBoost = isMobile ? 0.52 : 0.68;
    ortho.zoom = Math.min(size.height / viewH, size.width / viewW) * (1 + roamBoost * rm) * (1 + 2.6 * zm);
    ortho.updateProjectionMatrix();
  });

  return (
    <group>
      {/* Bright, airy storybook lighting so 3D diorama colors stay luminous and soft */}
      <ambientLight intensity={0.72} color="#ffffff" />
      <hemisphereLight args={["#ffffff", "#e2dcd2", 1.1]} />
      <directionalLight position={[4, 8, 6]} intensity={1.15} color="#fffaf0" />
      <directionalLight position={[-4, 4, -4]} intensity={0.55} color="#dbeafe" />

      {pageMats.map((m, k) => (
        <group key={k} ref={(el) => void (pageRefs.current[k] = el)}>
          <mesh geometry={pageGeo.front} material={m.front} />
          <mesh geometry={pageGeo.back} material={m.back} />
          {/* 3D Low-Poly Wall Relief on front face (Room k's RIGHT wall) */}
          {k < N && (
            <group ref={(el) => void (wallRightRefs.current[k] = el)}>
              <SeasonWall3D season={ROOMS[logicalOf(k)].name as Season} wall="right" clipPlanes={wallClipPlanes[k].right} />
            </group>
          )}
          {/* 3D Low-Poly Wall Relief on back face (Room k-1's LEFT wall) */}
          {k > 0 && (
            <group
              ref={(el) => void (wallLeftRefs.current[k - 1] = el)}
              position={[L, 0, 0]}
              rotation={[0, Math.PI, 0]}
            >
              <SeasonWall3D season={ROOMS[logicalOf(k - 1)].name as Season} wall="left" clipPlanes={wallClipPlanes[k - 1].left} />
            </group>
          )}
          {hots.front[k].map(({ room, hot }) => (
            <Hotspot key={`f${hot.spot}`} hot={hot} room={room} onPick={pick(room)} />
          ))}
          {hots.back[k].map(({ room, hot }) => (
            <Hotspot key={`b${hot.spot}`} hot={hot} room={room} onPick={pick(room)} />
          ))}
          <Line
            ref={(el) => void (outlineRefs.current[k] = el as unknown as Line2 | null)}
            points={outlines[k]}
            color={INK_HEX}
            lineWidth={1.7}
            transparent
          />
        </group>
      ))}
      {floors.map((fl, p) => (
        <group key={p}>
          <mesh geometry={fl.geo} material={fl.mat} />
          <Line
            ref={(el) => void (floorLineRefs.current[p] = el as unknown as Line2 | null)}
            points={floorLinePts[p]}
            transparent
            color={INK_HEX}
            lineWidth={1.5}
          />
        </group>
      ))}
      {Array.from({ length: N }, (_, p) => {
        const season = ROOMS[logicalOf(p)].name as Season;
        return (
          <group key={`diorama-${p}`}>
            <group
              ref={(el) => {
                veilRefs.current[p] = el;
              }}
            >
              <TransitionVeil3D season={season} revealRef={roomRevealRefs.current[p]} />
            </group>
            <group
              ref={(el) => {
                treeRefs.current[p] = el;
              }}
            >
              <SeasonTree3D
                season={season}
                progressRef={treeProgressRefs.current[p]}
                floorFlatRef={floorFlatRefs.current[p]}
              />
            </group>
            <group
              ref={(el) => {
                groundPosRefs.current[p] = el;
              }}
            >
              <SeasonGroundCover3D season={season} side="posX" />
            </group>
            <group
              ref={(el) => {
                groundNegRefs.current[p] = el;
              }}
            >
              <SeasonGroundCover3D season={season} side="negX" />
            </group>
          </group>
        );
      })}
      {popups.map((list, p) =>
        list.map((pu, j) => (
          <group
            key={`${p}-${j}`}
            ref={(el) => {
              popRefs.current[p][j] = { ...(popRefs.current[p][j] ?? { hinge: null }), outer: el };
            }}
          >
            <group
              ref={(el) => {
                popRefs.current[p][j] = { ...(popRefs.current[p][j] ?? { outer: null }), hinge: el };
              }}
            >
              <mesh geometry={pu.geo} material={pu.mat} />
              {hots.cards[p][j]?.map((hot) => <Hotspot key={hot.spot} hot={hot} room={p} onPick={pick(p)} />)}
            </group>
          </group>
        )),
      )}
    </group>
  );
}
