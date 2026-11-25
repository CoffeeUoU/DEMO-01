"use client";

import React, { useMemo, useRef } from "react";
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

export default function SeasonAtmosphere3D({ season }: { season: Season }) {
  const raysGroupRef = useRef<THREE.Group>(null);
  const rayMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const moteRefs = useRef<(THREE.Mesh | null)[]>([]);
  const weatherGroupRef = useRef<THREE.Group>(null);
  const weatherItemRefs = useRef<(THREE.Mesh | null)[]>([]);

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

  // 16 slow-drifting bokeh dust motes
  const motes = useMemo(() => {
    const r = makeRng(season === "spring" ? 701 : season === "summer" ? 702 : season === "autumn" ? 703 : 704);
    const col =
      season === "spring" ? "#fff0f5" : season === "summer" ? "#f4ffd6" : season === "autumn" ? "#ffe4a8" : "#d9ecff";
    return Array.from({ length: 16 }, () => ({
      x: (r() - 0.5) * 0.78,
      y: 0.14 + r() * 0.78,
      z: (r() - 0.5) * 0.68,
      sz: 0.008 + r() * 0.008,
      ph: r() * 6.28,
      col,
    }));
  }, [season]);

  // Extra micro-weather particles (rain streaks for spring/summer, windblown maple leaves for autumn, heavy snow for winter)
  const weatherParticles = useMemo(() => {
    const r = makeRng(880 + (season === "spring" ? 1 : season === "summer" ? 2 : season === "autumn" ? 3 : 4));
    const count = season === "autumn" ? 28 : 42;
    const cols =
      season === "spring" || season === "summer"
        ? ["#cceaff", "#e6f5ff"]
        : season === "autumn"
          ? ["#ff8c4a", "#ffc95c", "#eb5a42"]
          : ["#ffffff", "#e2f0ff"];
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * 0.92,
      y: 0.06 + r() * 0.96,
      z: (r() - 0.5) * 0.84,
      spd: season === "spring" || season === "summer" ? 1.35 + r() * 0.55 : season === "autumn" ? 0.42 + r() * 0.25 : 0.32 + r() * 0.22,
      ph: r() * 6.28,
      sz: season === "winter" ? 0.014 + r() * 0.009 : season === "autumn" ? 0.020 + r() * 0.010 : 0.004,
      col: cols[Math.floor(r() * cols.length)],
    }));
  }, [season]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const alt = book.weatherAlt;

    // Gentle volumetric ray breathing (dims softly when rain/blizzard is active)
    for (let i = 0; i < 3; i++) {
      const m = rayMatRefs.current[i];
      if (!m) continue;
      const targetOp = alt ? rayCfg.baseOp * 0.28 : rayCfg.baseOp * (0.78 + 0.28 * Math.sin(t * 0.8 + i * 1.4));
      m.opacity += (targetOp - m.opacity) * 0.08;
    }

    // Slow dreamy bokeh motes
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

    // Toggleable micro-weather overlay
    if (weatherGroupRef.current) {
      weatherGroupRef.current.visible = alt;
      if (alt) {
        for (let i = 0; i < weatherParticles.length; i++) {
          const mesh = weatherItemRefs.current[i];
          if (!mesh) continue;
          const p = weatherParticles[i];
          const y = (((p.y - t * p.spd) % 0.96) + 0.96) % 0.96 + 0.04;
          if (season === "spring" || season === "summer") {
            // Slanted fine rain streaks
            const x = p.x - (1 - y) * 0.14;
            mesh.position.set(x, y, p.z);
          } else if (season === "autumn") {
            // Gusting windblown maple leaves
            const x = (((p.x + t * 0.45) % 0.92) + 0.92) % 0.92 - 0.46;
            mesh.position.set(x, y, p.z + Math.sin(t * 2.4 + p.ph) * 0.08);
            mesh.rotation.set(t * 3.2 + p.ph, t * 2.4, t * 1.9);
          } else {
            // Cozy heavy winter snowfall
            mesh.position.set(
              p.x + Math.sin(t * 1.6 + p.ph) * 0.09,
              y,
              p.z + Math.cos(t * 1.3 + p.ph) * 0.08,
            );
          }
        }
      }
    }
  });

  const isRain = season === "spring" || season === "summer";

  return (
    <group>
      {/* 1. Soft Volumetric God Rays (morning sunbeams / amber dusk / silver moonbeam) */}
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

      {/* 2. Slow-drifting bokeh dust motes */}
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

      {/* 3. Toggleable Micro-Weather Overlay (Rain / Autumn Gust / Heavy Snowfall) */}
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
              <cylinderGeometry args={[0.0014, 0.0014, 0.068, 4]} />
            ) : season === "autumn" ? (
              <boxGeometry args={[p.sz * 1.4, p.sz * 0.25, p.sz]} />
            ) : (
              <sphereGeometry args={[p.sz, 6, 6]} />
            )}
            <meshBasicMaterial color={p.col} transparent opacity={isRain ? 0.55 : 0.92} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
