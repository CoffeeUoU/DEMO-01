"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Season } from "./SeasonTree3D";
import { getTerrainY } from "./SeasonGroundCover3D";
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

// Uniformly sample (x, z) across the ENTIRE open diamond room (|x| + |z - 0.028| <= radius)
function sampleDiamond(r: () => number, radius = 0.67): [number, number] {
  const u = (r() - 0.5) * 2;
  const v = (r() - 0.5) * 2;
  const x = ((u + v) * 0.5) * radius;
  const z = 0.028 + ((u - v) * 0.5) * radius;
  return [x, z];
}

export default function SeasonAtmosphere3D({ season }: { season: Season }) {
  const raysGroupRef = useRef<THREE.Group>(null);
  const rayMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const moteRefs = useRef<(THREE.Mesh | null)[]>([]);
  const weatherGroupRef = useRef<THREE.Group>(null);
  const weatherItemRefs = useRef<(THREE.Mesh | null)[]>([]);
  const splashRefs = useRef<(THREE.Mesh | null)[]>([]);

  const rayCfg = useMemo(() => {
    switch (season) {
      case "spring":
        return { color: "#fff5da", pos: [0.14, 0.72, -0.18] as [number, number, number], rotZ: 0.32, baseOp: 0.085 };
      case "summer":
        return { color: "#fff8d6", pos: [0.16, 0.74, -0.18] as [number, number, number], rotZ: 0.28, baseOp: 0.095 };
      case "autumn":
        return { color: "#ffd28a", pos: [0.18, 0.68, -0.18] as [number, number, number], rotZ: 0.44, baseOp: 0.11 };
      case "winter":
        return { color: "#c2dcff", pos: [-0.16, 0.72, -0.20] as [number, number, number], rotZ: -0.34, baseOp: 0.10 };
    }
  }, [season]);

  // 20 slow-drifting bokeh dust motes across the entire season room
  const motes = useMemo(() => {
    const r = makeRng(season === "spring" ? 701 : season === "summer" ? 702 : season === "autumn" ? 703 : 704);
    const col =
      season === "spring" ? "#fff0f5" : season === "summer" ? "#f4ffd6" : season === "autumn" ? "#ffe4a8" : "#d9ecff";
    return Array.from({ length: 20 }, () => {
      const [x, z] = sampleDiamond(r, 0.62);
      return { x, y: 0.14 + r() * 0.92, z, sz: 0.008 + r() * 0.008, ph: r() * 6.28, col };
    });
  }, [season]);

  // Full-room micro-weather particles covering ALL 4 diamond corners & full wall height (gentle, poetic pace)
  const weatherParticles = useMemo(() => {
    const r = makeRng(880 + (season === "spring" ? 1 : season === "summer" ? 2 : season === "autumn" ? 3 : 4));
    const count = season === "autumn" ? 28 : season === "winter" ? 46 : 44;
    const cols =
      season === "spring" || season === "summer"
        ? ["#c8e8ff", "#e8f6ff", "#b5dfff"]
        : season === "autumn"
          ? ["#ff8c4a", "#ffc95c", "#eb5a42", "#ffa854"]
          : ["#ffffff", "#e2f0ff", "#d4e8ff"];
    return Array.from({ length: count }, () => {
      const [x, z] = sampleDiamond(r, 0.68);
      return {
        x,
        y: 0.04 + r() * 1.20,
        z,
        spd:
          season === "spring" || season === "summer"
            ? 0.68 + r() * 0.28
            : season === "autumn"
              ? 0.16 + r() * 0.12
              : 0.12 + r() * 0.10,
        ph: r() * 6.28,
        sz: season === "winter" ? 0.012 + r() * 0.008 : season === "autumn" ? 0.018 + r() * 0.009 : 0.004,
        col: cols[Math.floor(r() * cols.length)],
      };
    });
  }, [season]);

  // 9 gentle rain splash ripples spread across the whole Spring/Summer diamond floor
  const rainSplashes = useMemo(() => {
    if (season !== "spring" && season !== "summer") return [];
    const r = makeRng(season === "spring" ? 951 : 952);
    return Array.from({ length: 9 }, () => {
      const [x, z] = sampleDiamond(r, 0.62);
      return { x, y: getTerrainY(season, x, z) + 0.008, z, ph: r() * 6.28, spd: 0.72 + r() * 0.35 };
    });
  }, [season]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const alt = book.weatherAlt;

    for (let i = 0; i < 3; i++) {
      const m = rayMatRefs.current[i];
      if (!m) continue;
      const targetOp = alt ? rayCfg.baseOp * 0.22 : rayCfg.baseOp * (0.78 + 0.28 * Math.sin(t * 0.8 + i * 1.4));
      m.opacity += (targetOp - m.opacity) * 0.08;
    }

    for (let i = 0; i < motes.length; i++) {
      const mesh = moteRefs.current[i];
      if (!mesh) continue;
      const m = motes[i];
      mesh.position.set(
        m.x + Math.sin(t * 0.45 + m.ph) * 0.05,
        m.y + Math.cos(t * 0.35 + m.ph) * 0.04,
        m.z + Math.sin(t * 0.4 + m.ph * 1.3) * 0.05,
      );
      const pulse = 0.72 + 0.35 * Math.sin(t * 1.8 + m.ph);
      mesh.scale.setScalar(m.sz * pulse);
    }

    if (weatherGroupRef.current) {
      weatherGroupRef.current.visible = alt;
      if (alt) {
        for (let i = 0; i < weatherParticles.length; i++) {
          const mesh = weatherItemRefs.current[i];
          if (!mesh) continue;
          const p = weatherParticles[i];
          const y = (((p.y - t * p.spd) % 1.22) + 1.22) % 1.22 + 0.03;
          if (season === "spring" || season === "summer") {
            const x = p.x - (1.22 - y) * 0.13;
            mesh.position.set(x, y, p.z);
          } else if (season === "autumn") {
            // Gentle slow drifting autumn breeze across the entire diamond
            const span = Math.max(0.18, 0.68 - Math.abs(p.z - 0.028));
            const x = (((p.x + t * 0.18 + span) % (span * 2)) + span * 2) % (span * 2) - span;
            mesh.position.set(x, y, p.z + Math.sin(t * 1.1 + p.ph) * 0.05);
            mesh.rotation.set(t * 1.4 + p.ph, t * 1.1, t * 0.9);
          } else {
            mesh.position.set(
              p.x + Math.sin(t * 0.85 + p.ph) * 0.06,
              y,
              p.z + Math.cos(t * 0.72 + p.ph) * 0.05,
            );
          }
        }

        // Ground raindrop splash rings across the full meadow
        for (let i = 0; i < rainSplashes.length; i++) {
          const sp = splashRefs.current[i];
          if (!sp) continue;
          const d = rainSplashes[i];
          const u = (t * d.spd + d.ph) % 1;
          sp.scale.setScalar(0.3 + u * 1.4);
          const mat = sp.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - u) * 0.52;
        }
      }
    }
  });

  const isRain = season === "spring" || season === "summer";

  return (
    <group>
      {/* 1. Soft Volumetric God Rays */}
      <group ref={raysGroupRef} position={rayCfg.pos} rotation={[0.12, 0, rayCfg.rotZ]}>
        {[
          { x: -0.09, rTop: 0.035, rBot: 0.13, len: 0.85 },
          { x: 0.0, rTop: 0.045, rBot: 0.16, len: 0.92 },
          { x: 0.10, rTop: 0.030, rBot: 0.12, len: 0.80 },
        ].map((beam, i) => (
          <mesh key={i} position={[beam.x, -0.18, 0]}>
            <cylinderGeometry args={[beam.rTop, beam.rBot, beam.len, 10, 1, true]} />
            <meshBasicMaterial
              ref={(el) => {
                rayMatRefs.current[i] = el;
              }}
              color={rayCfg.color}
              transparent
              opacity={rayCfg.baseOp}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>

      {/* 2. Full-room slow-drifting bokeh dust motes */}
      {motes.map((m, i) => (
        <mesh
          key={`mote-${i}`}
          ref={(el) => {
            moteRefs.current[i] = el;
          }}
          position={[m.x, m.y, m.z]}
        >
          <sphereGeometry args={[1, 7, 7]} />
          <meshBasicMaterial color={m.col} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}

      {/* 3. Full-Room Micro-Weather Overlay (96 rain streaks + ground ripples / 56 autumn gust leaves / 96 snowflakes) */}
      <group ref={weatherGroupRef} visible={false}>
        {weatherParticles.map((p, i) => (
          <mesh
            key={`wp-${i}`}
            ref={(el) => {
              weatherItemRefs.current[i] = el;
            }}
            position={[p.x, p.y, p.z]}
            rotation={isRain ? [0, 0, -0.16] : [0, 0, 0]}
          >
            {isRain ? (
              <cylinderGeometry args={[0.0014, 0.0014, 0.072, 4]} />
            ) : season === "autumn" ? (
              <boxGeometry args={[p.sz * 1.4, p.sz * 0.25, p.sz]} />
            ) : (
              <sphereGeometry args={[p.sz, 6, 6]} />
            )}
            <meshBasicMaterial color={p.col} transparent opacity={isRain ? 0.52 : 0.92} depthWrite={false} />
          </mesh>
        ))}

        {/* Raindrop splash rings scattered across the whole Spring/Summer floor */}
        {rainSplashes.map((sp, i) => (
          <mesh
            key={`rsp-${i}`}
            ref={(el) => {
              splashRefs.current[i] = el;
            }}
            position={[sp.x, sp.y, sp.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.010, 0.015, 14]} />
            <meshBasicMaterial color="#e8f6ff" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
