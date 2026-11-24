"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import type { Season as SeasonKey } from "./SeasonTree3D";

const SHARED_BLOB_GEO = new THREE.IcosahedronGeometry(1, 1);

// Sculpted organic curved goose wing geometries (inner wing + swept outer wingtip, no boxy shapes!)
function createGooseWingInnerGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.008);
  s.quadraticCurveTo(0.011, 0.011, 0.022, 0.005);
  s.lineTo(0.022, -0.007);
  s.quadraticCurveTo(0.010, -0.009, 0, -0.008);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0018, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

function createGooseWingOuterGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.005);
  s.quadraticCurveTo(0.012, 0.002, 0.024, -0.007);
  s.quadraticCurveTo(0.011, -0.011, 0, -0.007);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0014, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

const GOOSE_WING_INNER_GEO = createGooseWingInnerGeo();
const GOOSE_WING_OUTER_GEO = createGooseWingOuterGeo();

function BrightMat({
  color,
  boost = 0.34,
  opacity = 1,
  doubleSide = false,
}: {
  color: string;
  boost?: number;
  opacity?: number;
  doubleSide?: boolean;
}) {
  return (
    <meshLambertMaterial
      color={color}
      emissive={color}
      emissiveIntensity={boost}
      transparent={opacity < 1}
      opacity={opacity}
      side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

/* ==================== DISTANT MINIATURE SHRUBS / TREES (BACK RIDGE DEPTH) ==================== */
export function DistantRidgeTrees3D({ season }: { season: SeasonKey }) {
  const palette = useMemo(() => {
    switch (season) {
      case "spring":
        return {
          trunk: "#6a4c5e",
          leaves: ["#ffb8d2", "#a2e088", "#ffd4e5"],
        };
      case "summer":
        return {
          trunk: "#59443c",
          leaves: ["#6bc46e", "#8ee080", "#5ab363"],
        };
      case "autumn":
        return {
          trunk: "#5a3d35",
          leaves: ["#ff9a52", "#ffc95c", "#f26b4e"],
        };
      case "winter":
        return {
          trunk: "#4b4a62",
          leaves: ["#ffffff", "#e5f3ff", "#d4e8fc"],
        };
    }
  }, [season]);

  // Strictly inside the back diamond ridge (|x| + |z| <= 0.60)
  const spots: [number, number, number, number][] = [
    [-0.24, 0.03, -0.30, 0.72],
    [-0.14, 0.06, -0.39, 0.58],
    [0.14, 0.06, -0.39, 0.62],
    [0.27, 0.02, -0.27, 0.70],
  ];

  return (
    <group>
      {spots.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh position={[0, 0.032, 0]}>
            <cylinderGeometry args={[0.007, 0.011, 0.064, 6]} />
            <BrightMat color={palette.trunk} boost={0.26} />
          </mesh>
          <mesh geometry={SHARED_BLOB_GEO} position={[0, 0.082, 0]} scale={[0.044, 0.042, 0.044]}>
            <BrightMat color={palette.leaves[i % palette.leaves.length]} boost={0.38} />
          </mesh>
          <mesh geometry={SHARED_BLOB_GEO} position={[0.024, 0.066, 0.012]} scale={[0.03, 0.028, 0.03]}>
            <BrightMat color={palette.leaves[(i + 1) % palette.leaves.length]} boost={0.38} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ==================== GROUND PROPS PER SEASON (ZERO OVERLAP, INTERACTIVE) ==================== */
export function SeasonGroundProps3D({ season }: { season: SeasonKey }) {
  // Interactive boost timers stored in refs (zero React re-renders per frame)
  const waterBoostRef = useRef(0);
  const rippleTimeRef = useRef(0);
  const scarecrowSpinRef = useRef(0);
  const fireBoostRef = useRef(0);
  const mailBounceRef = useRef(0);

  const waterWheelRef = useRef<THREE.Group>(null);
  const rippleRef = useRef<THREE.Mesh>(null);
  const scarecrowRef = useRef<THREE.Group>(null);
  const flameOuterRef = useRef<THREE.Mesh>(null);
  const flameInnerRef = useRef<THREE.Mesh>(null);
  const fireLightRef = useRef<THREE.PointLight>(null);
  const emberRefs = useRef<(THREE.Mesh | null)[]>([]);
  const mailboxFlagRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, delta);

    if (waterBoostRef.current > 0) waterBoostRef.current = Math.max(0, waterBoostRef.current - dt);
    if (rippleTimeRef.current > 0) rippleTimeRef.current = Math.max(0, rippleTimeRef.current - dt);
    if (scarecrowSpinRef.current > 0) scarecrowSpinRef.current = Math.max(0, scarecrowSpinRef.current - dt);
    if (fireBoostRef.current > 0) fireBoostRef.current = Math.max(0, fireBoostRef.current - dt);
    if (mailBounceRef.current > 0) mailBounceRef.current = Math.max(0, mailBounceRef.current - dt);

    const waterBoost = waterBoostRef.current;
    const rippleTime = rippleTimeRef.current;
    const scarecrowSpin = scarecrowSpinRef.current;
    const fireBoost = fireBoostRef.current;
    const mailBounce = mailBounceRef.current;

    // Spring mailbox letter bounce
    if (mailboxFlagRef.current) {
      const pop = mailBounce > 0 ? Math.sin(mailBounce * 12) * 0.018 : 0;
      mailboxFlagRef.current.position.y = 0.145 + Math.abs(pop);
      mailboxFlagRef.current.rotation.z = Math.sin(t * 2.2) * 0.06 + (mailBounce > 0 ? Math.sin(mailBounce * 18) * 0.2 : 0);
    }

    // Summer waterwheel + pond ripple easter egg
    if (waterWheelRef.current) {
      const spd = 1.4 + waterBoost * 3.2;
      waterWheelRef.current.rotation.x += dt * spd;
    }
    if (rippleRef.current) {
      if (rippleTime > 0) {
        const u = 1 - rippleTime / 1.4;
        rippleRef.current.visible = true;
        rippleRef.current.scale.setScalar(0.35 + u * 1.45);
        const mat = rippleRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - u) * 0.72);
      } else {
        rippleRef.current.visible = false;
      }
    }

    // Autumn scarecrow gentle wind sway + click cheer
    if (scarecrowRef.current) {
      const sway = Math.sin(t * 1.8) * 0.065;
      const cheer = scarecrowSpin > 0 ? Math.sin(scarecrowSpin * 10) * 0.25 : 0;
      scarecrowRef.current.rotation.z = sway + cheer;
      scarecrowRef.current.rotation.y = 0.48 + (scarecrowSpin > 0 ? (1.4 - scarecrowSpin) * 4.5 : 0);
    }

    // Winter campfire flicker + click surge
    const boostMul = 1 + fireBoost * 0.55;
    if (flameOuterRef.current) {
      const f = 0.92 + Math.sin(t * 11) * 0.12 + Math.cos(t * 17) * 0.06;
      flameOuterRef.current.scale.set(0.95 * boostMul * 0.85, f * boostMul, 0.95 * boostMul * 0.85);
      flameOuterRef.current.rotation.y = t * 2.2;
    }
    if (flameInnerRef.current) {
      const f = 0.9 + Math.cos(t * 14) * 0.14;
      flameInnerRef.current.scale.set(0.85 * boostMul * 0.85, f * boostMul, 0.85 * boostMul * 0.85);
    }
    if (fireLightRef.current) {
      fireLightRef.current.intensity = (0.75 + Math.sin(t * 13) * 0.15) * boostMul;
    }
    for (let i = 0; i < 4; i++) {
      const em = emberRefs.current[i];
      if (!em) continue;
      const u = (t * (0.65 + i * 0.12) + i * 0.25) % 1;
      em.position.set(
        Math.sin(u * 6 + i * 2) * 0.025,
        0.04 + u * (0.14 + fireBoost * 0.07),
        Math.cos(u * 5 + i) * 0.025,
      );
      em.scale.setScalar((1 - u) * (0.008 + fireBoost * 0.003));
    }
  });

  const stopProp = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
  };

  if (season === "spring") {
    return (
      <group>
        {/* 1. Left-front: Checkered Picnic Blanket + Woven Basket + Strawberry Cake */}
        <group position={[-0.28, 0.005, 0.16]} rotation={[0, 0.42, 0]}>
          {/* Blanket base */}
          <mesh position={[0, 0.003, 0]}>
            <boxGeometry args={[0.19, 0.005, 0.15]} />
            <BrightMat color="#fff7fa" boost={0.44} />
          </mesh>
          {/* Pink gingham stripes */}
          {[-0.06, 0, 0.06].map((gx, i) => (
            <mesh key={`gx-${i}`} position={[gx, 0.0062, 0]}>
              <boxGeometry args={[0.028, 0.0012, 0.148]} />
              <BrightMat color="#ff9ec2" boost={0.42} />
            </mesh>
          ))}
          {[-0.042, 0.042].map((gz, i) => (
            <mesh key={`gz-${i}`} position={[0, 0.0066, gz]}>
              <boxGeometry args={[0.188, 0.0012, 0.024]} />
              <BrightMat color="#ffb5d0" boost={0.42} opacity={0.85} />
            </mesh>
          ))}
          {/* Woven Picnic Basket */}
          <group position={[-0.038, 0.026, -0.015]} rotation={[0, 0.25, 0]}>
            <mesh>
              <boxGeometry args={[0.068, 0.042, 0.048]} />
              <BrightMat color="#dfa96e" boost={0.34} />
            </mesh>
            <mesh position={[0, 0.023, 0]}>
              <boxGeometry args={[0.074, 0.008, 0.052]} />
              <BrightMat color="#cfa066" boost={0.32} />
            </mesh>
            {/* Basket handle */}
            <mesh position={[0, 0.028, 0]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.026, 0.004, 6, 12, Math.PI]} />
              <BrightMat color="#b8844c" boost={0.30} />
            </mesh>
          </group>
          {/* Cute Strawberry Shortcake on plate */}
          <group position={[0.042, 0.012, 0.02]}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.028, 0.024, 0.005, 12]} />
              <BrightMat color="#ffffff" boost={0.48} />
            </mesh>
            <mesh position={[0, 0.014, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.022, 12]} />
              <BrightMat color="#fff1d6" boost={0.42} />
            </mesh>
            <mesh position={[0, 0.026, 0]}>
              <cylinderGeometry args={[0.021, 0.021, 0.006, 12]} />
              <BrightMat color="#ffffff" boost={0.5} />
            </mesh>
            <mesh position={[0, 0.034, 0]}>
              <sphereGeometry args={[0.007, 8, 8]} />
              <BrightMat color="#f25268" boost={0.42} />
            </mesh>
          </group>
        </group>

        {/* 2. Right-wing: Mint-Green Vintage Mailbox with peeking letter (clickable!) */}
        <group
          position={[0.34, 0, -0.06]}
          rotation={[0, -0.55, 0]}
          onClick={(e) => {
            stopProp(e);
            mailBounceRef.current = 1.2;
          }}
        >
          {/* Wooden post */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.008, 0.01, 0.12, 8]} />
            <BrightMat color="#d9b48a" boost={0.32} />
          </mesh>
          {/* Mailbox body */}
          <mesh position={[0, 0.128, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.026, 0.026, 0.068, 12]} />
            <BrightMat color="#88d8c0" boost={0.38} />
          </mesh>
          <mesh position={[0, 0.115, 0]}>
            <boxGeometry args={[0.068, 0.024, 0.052]} />
            <BrightMat color="#88d8c0" boost={0.38} />
          </mesh>
          {/* Red flag */}
          <mesh position={[0.015, 0.142, 0.03]}>
            <boxGeometry args={[0.005, 0.036, 0.005]} />
            <BrightMat color="#ff7a8a" boost={0.42} />
          </mesh>
          {/* Peeking white love letter */}
          <group ref={mailboxFlagRef} position={[0.036, 0.145, 0]}>
            <mesh rotation={[0, 0, -0.25]}>
              <boxGeometry args={[0.028, 0.02, 0.004]} />
              <BrightMat color="#ffffff" boost={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.003]}>
              <sphereGeometry args={[0.004, 6, 6]} />
              <BrightMat color="#ff6b8b" boost={0.45} />
            </mesh>
          </group>
        </group>

        {/* 3. Front stepping-stone accents: Three Spotted Mushrooms + Mini Flower Trellis */}
        <group position={[-0.13, 0, 0.30]}>
          {[
            [0, 0, 0, 1.0, "#ff879c"],
            [0.035, 0, 0.022, 0.72, "#ffa87a"],
            [-0.028, 0, 0.03, 0.62, "#ff879c"],
          ].map(([mx, my, mz, ms, col], i) => (
            <group key={i} position={[mx as number, my as number, mz as number]} scale={ms as number}>
              <mesh position={[0, 0.016, 0]}>
                <cylinderGeometry args={[0.007, 0.01, 0.032, 8]} />
                <BrightMat color="#fff4e4" boost={0.42} />
              </mesh>
              <mesh position={[0, 0.034, 0]} scale={[1.1, 0.65, 1.1]}>
                <sphereGeometry args={[0.022, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
                <BrightMat color={col as string} boost={0.42} />
              </mesh>
              <mesh position={[0.008, 0.043, 0.008]}>
                <sphereGeometry args={[0.0045, 6, 6]} />
                <BrightMat color="#ffffff" boost={0.5} />
              </mesh>
              <mesh position={[-0.009, 0.041, -0.005]}>
                <sphereGeometry args={[0.004, 6, 6]} />
                <BrightMat color="#ffffff" boost={0.5} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Mini white wooden trellis with climbing buds on front-right */}
        <group position={[0.15, 0, 0.28]} rotation={[0, -0.55, 0]}>
          {[-0.035, 0.035].map((px, i) => (
            <mesh key={i} position={[px, 0.055, 0]}>
              <boxGeometry args={[0.009, 0.11, 0.009]} />
              <BrightMat color="#fff8f2" boost={0.46} />
            </mesh>
          ))}
          {[0.03, 0.065, 0.098].map((py, i) => (
            <mesh key={i} position={[0, py, 0]}>
              <boxGeometry args={[0.086, 0.008, 0.007]} />
              <BrightMat color="#fff8f2" boost={0.46} />
            </mesh>
          ))}
          {[
            [-0.025, 0.085, 0.008, "#ff9ec4"],
            [0.018, 0.098, 0.008, "#ffe28a"],
            [0.028, 0.055, 0.008, "#ffb3d0"],
          ].map(([fx, fy, fz, col], i) => (
            <mesh key={i} position={[fx as number, fy as number, fz as number]}>
              <sphereGeometry args={[0.011, 8, 8]} />
              <BrightMat color={col as string} boost={0.45} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }

  if (season === "summer") {
    return (
      <group>
        {/* 1. Left-wing (beside bench): Red & White Beach Umbrella + Iced Lemonade Side Table */}
        <group position={[-0.36, 0, 0.07]} rotation={[0, 0.3, 0]}>
          {/* Umbrella pole */}
          <mesh position={[0, 0.11, 0]} rotation={[0, 0, -0.1]}>
            <cylinderGeometry args={[0.006, 0.007, 0.22, 8]} />
            <BrightMat color="#e6c49a" boost={0.34} />
          </mesh>
          {/* Striped canopy */}
          <group position={[0.012, 0.215, 0]} rotation={[0, 0, -0.1]}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
              <mesh key={k} rotation={[0, (k * Math.PI) / 4, 0]}>
                <coneGeometry args={[0.115, 0.048, 8, 1, false, 0, Math.PI / 4 + 0.04]} />
                <BrightMat color={k % 2 === 0 ? "#ff6f7d" : "#ffffff"} boost={0.42} />
              </mesh>
            ))}
            <mesh position={[0, 0.026, 0]}>
              <sphereGeometry args={[0.01, 8, 8]} />
              <BrightMat color="#ffe180" boost={0.44} />
            </mesh>
          </group>
          {/* Small round table + iced lemonade glass */}
          <group position={[0.055, 0, 0.045]}>
            <mesh position={[0, 0.028, 0]}>
              <cylinderGeometry args={[0.006, 0.012, 0.056, 8]} />
              <BrightMat color="#d9b084" boost={0.32} />
            </mesh>
            <mesh position={[0, 0.058, 0]}>
              <cylinderGeometry args={[0.036, 0.036, 0.008, 14]} />
              <BrightMat color="#f5d9b2" boost={0.38} />
            </mesh>
            {/* Lemonade glass */}
            <mesh position={[0.006, 0.076, 0]}>
              <cylinderGeometry args={[0.011, 0.009, 0.028, 10]} />
              <BrightMat color="#fff078" boost={0.48} />
            </mesh>
            {/* Pink straw */}
            <mesh position={[0.011, 0.095, 0]} rotation={[0, 0, -0.25]}>
              <cylinderGeometry args={[0.0018, 0.0018, 0.024, 6]} />
              <BrightMat color="#ff7fa0" boost={0.44} />
            </mesh>
          </group>
        </group>

        {/* 2. Right-back (behind pond): Rotating Wooden Waterwheel + Cattail Reeds (clickable!) */}
        <group
          position={[0.33, 0, -0.06]}
          rotation={[0, -0.42, 0]}
          onClick={(e) => {
            stopProp(e);
            waterBoostRef.current = 2.0;
            rippleTimeRef.current = 1.4;
          }}
        >
          {/* A-frame support */}
          <mesh position={[0.035, 0.065, 0]} rotation={[0, 0, 0.15]}>
            <boxGeometry args={[0.012, 0.13, 0.016]} />
            <BrightMat color="#b88456" boost={0.30} />
          </mesh>
          <mesh position={[-0.035, 0.065, 0]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[0.012, 0.13, 0.016]} />
            <BrightMat color="#b88456" boost={0.30} />
          </mesh>
          {/* Rotating Wheel */}
          <group ref={waterWheelRef} position={[0, 0.088, 0]}>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.068, 0.008, 6, 16]} />
              <BrightMat color="#d49e6a" boost={0.34} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.055, 8]} />
              <BrightMat color="#a87448" boost={0.30} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <group key={k} rotation={[(k * Math.PI) / 3, 0, 0]}>
                <mesh>
                  <boxGeometry args={[0.012, 0.136, 0.008]} />
                  <BrightMat color="#c7915c" boost={0.32} />
                </mesh>
                <mesh position={[0, 0.068, 0]}>
                  <boxGeometry args={[0.036, 0.018, 0.007]} />
                  <BrightMat color="#e0ad77" boost={0.35} />
                </mesh>
              </group>
            ))}
          </group>
          {/* Cattail Reeds next to waterwheel */}
          {[
            [-0.08, 0.05, 0.14],
            [-0.06, 0.07, 0.17],
            [-0.095, 0.06, 0.12],
          ].map(([rx, rz, rh], i) => (
            <group key={i} position={[rx, 0, rz]}>
              <mesh position={[0, rh / 2, 0]}>
                <cylinderGeometry args={[0.003, 0.004, rh, 6]} />
                <BrightMat color="#6bb868" boost={0.34} />
              </mesh>
              <mesh position={[0, rh * 0.82, 0]}>
                <cylinderGeometry args={[0.007, 0.007, 0.028, 8]} />
                <BrightMat color="#8c5a3c" boost={0.28} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Interactive pond ripple ring overlay at pond center [0.24, 0.016, 0.18] */}
        <mesh
          ref={rippleRef}
          position={[0.24, 0.016, 0.18]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.055, 0.072, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
        </mesh>

        {/* 3. Front-right (pond edge): Watermelon Wedge + Blue Bucket */}
        <group
          position={[0.13, 0.005, 0.31]}
          rotation={[0, -0.35, 0]}
          onClick={(e) => {
            stopProp(e);
            rippleTimeRef.current = 1.4;
          }}
        >
          {/* Watermelon wedge */}
          <group position={[-0.02, 0.022, 0]} rotation={[0.1, 0.4, 0]}>
            <mesh>
              <cylinderGeometry args={[0.032, 0.032, 0.016, 12, 1, false, 0, Math.PI]} />
              <BrightMat color="#ff5e73" boost={0.42} />
            </mesh>
            <mesh position={[0, -0.002, 0]} scale={[1.08, 1.05, 1.08]}>
              <cylinderGeometry args={[0.032, 0.032, 0.014, 12, 1, true, 0, Math.PI]} />
              <BrightMat color="#56b868" boost={0.36} />
            </mesh>
          </group>
          {/* Blue Bucket */}
          <group position={[0.035, 0.022, -0.01]}>
            <mesh>
              <cylinderGeometry args={[0.022, 0.017, 0.042, 12]} />
              <BrightMat color="#6ec4ff" boost={0.42} />
            </mesh>
            <mesh position={[0, 0.022, 0]}>
              <torusGeometry args={[0.022, 0.0025, 6, 12, Math.PI]} />
              <BrightMat color="#e8f6ff" boost={0.46} />
            </mesh>
          </group>
        </group>
      </group>
    );
  }

  if (season === "autumn") {
    return (
      <group>
        {/* 1. Left-wing: Wooden Harvest Wheelbarrow filled with wheat & red apples */}
        <group position={[-0.35, 0, 0.04]} rotation={[0, 0.55, 0]}>
          {/* Cart body */}
          <mesh position={[0, 0.045, 0]}>
            <boxGeometry args={[0.095, 0.042, 0.066]} />
            <BrightMat color="#c78b54" boost={0.32} />
          </mesh>
          {/* Handles */}
          {[-0.024, 0.024].map((hz, i) => (
            <mesh key={i} position={[-0.072, 0.042, hz]} rotation={[0, 0, 0.12]}>
              <boxGeometry args={[0.065, 0.009, 0.009]} />
              <BrightMat color="#a86f3e" boost={0.28} />
            </mesh>
          ))}
          {/* Support legs */}
          {[-0.022, 0.022].map((lz, i) => (
            <mesh key={i} position={[-0.032, 0.018, lz]}>
              <boxGeometry args={[0.009, 0.036, 0.009]} />
              <BrightMat color="#9e6738" boost={0.28} />
            </mesh>
          ))}
          {/* Front wheel */}
          <mesh position={[0.058, 0.026, 0]}>
            <torusGeometry args={[0.022, 0.006, 6, 14]} />
            <BrightMat color="#6e4b36" boost={0.26} />
          </mesh>
          {/* Golden wheat sheaf & red apples inside */}
          <mesh position={[-0.01, 0.072, 0]} rotation={[0, 0, 0.25]}>
            <cylinderGeometry args={[0.02, 0.026, 0.08, 10]} />
            <BrightMat color="#ffd266" boost={0.42} />
          </mesh>
          {[
            [0.022, 0.072, 0.014],
            [0.028, 0.068, -0.012],
            [0.005, 0.078, -0.014],
          ].map(([ax, ay, az], i) => (
            <mesh key={i} position={[ax, ay, az]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <BrightMat color="#f25244" boost={0.40} />
            </mesh>
          ))}
        </group>

        {/* 2. Left-back slope: Swaying Cute Scarecrow with Straw Hat (clickable!) */}
        <group
          ref={scarecrowRef}
          position={[-0.31, 0.015, -0.10]}
          rotation={[0, 0.48, 0]}
          onClick={(e) => {
            stopProp(e);
            scarecrowSpinRef.current = 1.4;
          }}
        >
          {/* Center pole */}
          <mesh position={[0, 0.095, 0]}>
            <cylinderGeometry args={[0.007, 0.009, 0.19, 8]} />
            <BrightMat color="#9c6a40" boost={0.28} />
          </mesh>
          {/* Crossbar arms */}
          <mesh position={[0, 0.135, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.14, 6]} />
            <BrightMat color="#9c6a40" boost={0.28} />
          </mesh>
          {/* Shirt / tunic */}
          <mesh position={[0, 0.125, 0]}>
            <coneGeometry args={[0.036, 0.075, 8]} />
            <BrightMat color="#e87a4a" boost={0.36} />
          </mesh>
          {/* Burlap head */}
          <mesh position={[0, 0.178, 0]}>
            <sphereGeometry args={[0.024, 10, 10]} />
            <BrightMat color="#f5dbb0" boost={0.40} />
          </mesh>
          {/* Pointed straw hat */}
          <mesh position={[0, 0.198, 0]}>
            <cylinderGeometry args={[0.044, 0.048, 0.007, 12]} />
            <BrightMat color="#f5c962" boost={0.42} />
          </mesh>
          <mesh position={[0, 0.218, 0]}>
            <coneGeometry args={[0.026, 0.038, 10]} />
            <BrightMat color="#f5c962" boost={0.42} />
          </mesh>
        </group>

        {/* 3. Front-right: Two Round Golden Hay Bales + Scattered Red Apples */}
        <group position={[0.24, 0, 0.20]} rotation={[0, -0.4, 0]}>
          <mesh position={[0, 0.036, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.038, 0.038, 0.068, 14]} />
            <BrightMat color="#f5c85c" boost={0.40} />
          </mesh>
          <mesh position={[0.055, 0.028, 0.045]} rotation={[0, 0.6, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 0.054, 14]} />
            <BrightMat color="#ffd46b" boost={0.40} />
          </mesh>
          {[
            [-0.045, 0.011, 0.048],
            [-0.022, 0.011, 0.062],
            [0.018, 0.011, 0.065],
          ].map(([ax, ay, az], i) => (
            <mesh key={i} position={[ax, ay, az]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <BrightMat color="#f04e42" boost={0.40} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }

  // WINTER
  return (
    <group>
      {/* 1. Left-wing: Cozy Crackling Campfire with Stone Ring + Flickering Flames (clickable!) */}
      <group
        position={[-0.33, 0, 0.04]}
        onClick={(e) => {
          stopProp(e);
          fireBoostRef.current = 2.2;
        }}
      >
        {/* Ring of stones */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const ang = (k / 8) * Math.PI * 2;
          return (
            <mesh
              key={k}
              geometry={SHARED_BLOB_GEO}
              position={[Math.cos(ang) * 0.052, 0.012, Math.sin(ang) * 0.052]}
              scale={[0.018, 0.013, 0.016]}
            >
              <BrightMat color="#a8b4c8" boost={0.32} />
            </mesh>
          );
        })}
        {/* Crossed logs */}
        <mesh position={[0, 0.014, 0]} rotation={[0, 0.5, Math.PI / 2]}>
          <cylinderGeometry args={[0.009, 0.009, 0.075, 7]} />
          <BrightMat color="#7d4f34" boost={0.28} />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[0, -0.6, Math.PI / 2]}>
          <cylinderGeometry args={[0.009, 0.009, 0.075, 7]} />
          <BrightMat color="#6e432b" boost={0.28} />
        </mesh>
        {/* Outer orange flame */}
        <mesh ref={flameOuterRef} position={[0, 0.048, 0]}>
          <coneGeometry args={[0.028, 0.072, 7]} />
          <meshBasicMaterial color="#ff7e36" />
        </mesh>
        {/* Inner golden core */}
        <mesh ref={flameInnerRef} position={[0, 0.04, 0]}>
          <coneGeometry args={[0.016, 0.048, 7]} />
          <meshBasicMaterial color="#ffe478" />
        </mesh>
        {/* Rising sparks */}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            ref={(el) => {
              emberRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial color="#ffd56b" />
          </mesh>
        ))}
        <pointLight ref={fireLightRef} position={[0, 0.08, 0]} color="#ffaa52" intensity={0.85} distance={1.2} decay={2} />
      </group>

      {/* 2. Right-wing: Vintage Warm Streetlamp + Pair of Wooden Skis */}
      <group position={[0.34, 0, 0.06]} rotation={[0, -0.45, 0]}>
        {/* Streetlamp pole */}
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.006, 0.01, 0.26, 8]} />
          <BrightMat color="#47506b" boost={0.26} />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.018, 0.022, 0.02, 8]} />
          <BrightMat color="#47506b" boost={0.26} />
        </mesh>
        {/* Lamp head + glow */}
        <mesh position={[0, 0.275, 0]}>
          <cylinderGeometry args={[0.022, 0.016, 0.036, 6]} />
          <meshBasicMaterial color="#ffecaa" />
        </mesh>
        <mesh position={[0, 0.298, 0]}>
          <coneGeometry args={[0.028, 0.018, 6]} />
          <BrightMat color="#47506b" boost={0.26} />
        </mesh>
        <mesh position={[0, 0.275, 0]}>
          <sphereGeometry args={[0.058, 12, 12]} />
          <meshBasicMaterial color="#ffe18c" transparent opacity={0.30} depthWrite={false} />
        </mesh>
        {/* Planted Wooden Skis leaning beside lamp */}
        <group position={[-0.042, 0.055, 0.02]} rotation={[0.16, 0.2, -0.18]}>
          {[-0.009, 0.009].map((sx, i) => (
            <mesh key={i} position={[sx, 0, 0]}>
              <boxGeometry args={[0.011, 0.12, 0.004]} />
              <BrightMat color="#e86464" boost={0.38} />
            </mesh>
          ))}
        </group>
      </group>

      {/* 3. Front-right (before frozen pond): Wooden Sled with Gift Boxes */}
      <group position={[0.11, 0.005, 0.31]} rotation={[0, -0.32, 0]}>
        {/* Runners */}
        {[-0.024, 0.024].map((rz, i) => (
          <mesh key={i} position={[0, 0.008, rz]}>
            <boxGeometry args={[0.11, 0.006, 0.006]} />
            <BrightMat color="#a86e42" boost={0.30} />
          </mesh>
        ))}
        {/* Sled deck */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.095, 0.007, 0.054]} />
          <BrightMat color="#dba470" boost={0.35} />
        </mesh>
        {/* Gift box 1 (red with gold ribbon) */}
        <group position={[-0.015, 0.042, 0]}>
          <mesh>
            <boxGeometry args={[0.036, 0.034, 0.036]} />
            <BrightMat color="#f05a68" boost={0.40} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.038, 0.036, 0.007]} />
            <BrightMat color="#ffe278" boost={0.46} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.007, 0.036, 0.038]} />
            <BrightMat color="#ffe278" boost={0.46} />
          </mesh>
        </group>
        {/* Gift box 2 (mint with pink ribbon) */}
        <group position={[0.024, 0.036, 0.004]} rotation={[0, 0.3, 0]}>
          <mesh>
            <boxGeometry args={[0.026, 0.024, 0.026]} />
            <BrightMat color="#7cd4b8" boost={0.40} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.028, 0.026, 0.006]} />
            <BrightMat color="#ff8aa8" boost={0.44} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ==================== MID-AIR LIVING ELEMENTS PER SEASON ==================== */
export function SeasonAirProps3D({ season }: { season: SeasonKey }) {
  const butterflyRefs = useRef<(THREE.Group | null)[]>([]);
  const wingLRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wingRRefs = useRef<(THREE.Mesh | null)[]>([]);
  const dragonflyRefs = useRef<(THREE.Group | null)[]>([]);
  const geeseGroupRef = useRef<THREE.Group>(null);
  const gooseWingLRefs = useRef<(THREE.Group | null)[]>([]);
  const gooseWingRRefs = useRef<(THREE.Group | null)[]>([]);
  const gooseTipLRefs = useRef<(THREE.Mesh | null)[]>([]);
  const gooseTipRRefs = useRef<(THREE.Mesh | null)[]>([]);
  const skyLanternRefs = useRef<(THREE.Group | null)[]>([]);

  // Shared transparent materials for autumn geese so they fade purely via opacity (never clumping!)
  const gooseMats = useMemo(() => {
    const mk = (color: string, boost: number, doubleSide = false) =>
      new THREE.MeshLambertMaterial({
        color,
        emissive: color,
        emissiveIntensity: boost,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
    return {
      body: mk("#755c50", 0.32),
      chest: mk("#f4ead8", 0.40),
      neck: mk("#473732", 0.28),
      head: mk("#3d2f2a", 0.28),
      cheek: mk("#faf4ea", 0.44),
      beak: mk("#f29b4b", 0.42),
      tail: mk("#59453d", 0.30),
      wingInner: mk("#856a5c", 0.34, true),
      wingOuter: mk("#524038", 0.30, true),
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (season === "spring") {
      const bases = [
        { cx: -0.24, cy: 0.34, cz: 0.18, r: 0.12, spd: 1.15, ph: 0 },
        { cx: 0.24, cy: 0.42, cz: 0.12, r: 0.11, spd: 0.95, ph: 2.1 },
        { cx: 0.02, cy: 0.28, cz: 0.28, r: 0.10, spd: 1.35, ph: 4.2 },
      ];
      bases.forEach((b, i) => {
        const g = butterflyRefs.current[i];
        if (!g) return;
        const a = t * b.spd + b.ph;
        const nx = b.cx + Math.sin(a) * b.r;
        const ny = b.cy + Math.sin(a * 2.1) * 0.055;
        const nz = b.cz + Math.sin(a) * Math.cos(a) * b.r;
        const dx = Math.cos(a) * b.r;
        const dz = (Math.cos(a) * Math.cos(a) - Math.sin(a) * Math.sin(a)) * b.r;
        g.position.set(nx, ny, nz);
        g.rotation.y = Math.atan2(dx, dz);
        const flap = Math.sin(t * 14 + i * 2) * 0.72;
        if (wingLRefs.current[i]) wingLRefs.current[i]!.rotation.z = flap;
        if (wingRRefs.current[i]) wingRRefs.current[i]!.rotation.z = -flap;
      });
    } else if (season === "summer") {
      [
        { cx: 0.23, cy: 0.16, cz: 0.18, ph: 0 },
        { cx: 0.18, cy: 0.22, cz: 0.12, ph: 2.8 },
      ].forEach((d, i) => {
        const g = dragonflyRefs.current[i];
        if (!g) return;
        const a = t * 1.4 + d.ph;
        g.position.set(
          d.cx + Math.cos(a) * 0.09,
          d.cy + Math.sin(a * 2.4) * 0.025,
          d.cz + Math.sin(a) * 0.07,
        );
        g.rotation.y = -a;
      });
    } else if (season === "autumn") {
      if (geeseGroupRef.current) {
        // Comfortable mid-upper sky altitude strictly behind the tree canopy (z <= -0.34, zero clipping!)
        const u = (t * 0.085) % 1;
        const x = -0.44 + u * 0.88;
        const y = 0.89 + Math.sin(u * Math.PI) * 0.06 + Math.sin(u * Math.PI * 2) * 0.014;
        const z = -0.34 - Math.sin(u * Math.PI) * 0.03;

        // Exact derivative along the arc so geese always fly beak-first
        const dx = 0.88;
        const dy = Math.cos(u * Math.PI) * Math.PI * 0.06 + Math.cos(u * Math.PI * 2) * Math.PI * 2 * 0.014;
        const dz = -Math.cos(u * Math.PI) * Math.PI * 0.03;

        geeseGroupRef.current.position.set(x, y, z);
        geeseGroupRef.current.rotation.set(
          -Math.atan2(dy, Math.hypot(dx, dz)) * 0.65,
          Math.atan2(dx, dz),
          Math.sin(u * Math.PI * 2) * 0.06,
        );

        // Pure opacity fade-in (first 18%) & fade-out (last 18%) — formation spacing NEVER shrinks or clumps!
        const edge = Math.min(u / 0.18, (1 - u) / 0.18, 1);
        const alpha = edge * edge * (3 - 2 * edge);
        geeseGroupRef.current.visible = alpha > 0.01;
        Object.values(gooseMats).forEach((m) => {
          m.opacity = alpha;
        });
      }
      for (let i = 0; i < 5; i++) {
        // Organic two-stage S-wave wingbeat (outer wingtip lags inner shoulder beat)
        const phase = t * 5.2 + i * 0.65;
        const innerFlap = Math.sin(phase) * 0.36;
        const outerFlap = Math.sin(phase - 0.7) * 0.42;
        if (gooseWingLRefs.current[i]) gooseWingLRefs.current[i]!.rotation.z = -innerFlap;
        if (gooseWingRRefs.current[i]) gooseWingRRefs.current[i]!.rotation.z = innerFlap;
        if (gooseTipLRefs.current[i]) gooseTipLRefs.current[i]!.rotation.z = -outerFlap;
        if (gooseTipRRefs.current[i]) gooseTipRRefs.current[i]!.rotation.z = outerFlap;
      }
    } else if (season === "winter") {
      const lanes = [
        { x: -0.26, z: -0.18, base: 0.42, spd: 0.09, ph: 0 },
        { x: 0.28, z: -0.20, base: 0.54, spd: 0.08, ph: 2.0 },
        { x: 0.04, z: -0.32, base: 0.66, spd: 0.075, ph: 4.1 },
      ];
      lanes.forEach((l, i) => {
        const g = skyLanternRefs.current[i];
        if (!g) return;
        const u = (t * l.spd + i * 0.33) % 1;
        g.position.set(
          l.x + Math.sin(t * 0.9 + l.ph) * 0.035,
          0.36 + u * 0.68,
          l.z + Math.cos(t * 0.8 + l.ph) * 0.025,
        );
        g.rotation.z = Math.sin(t * 1.3 + l.ph) * 0.08;
        // Smooth scale fade-in at bottom and fade-out at top so lanterns never pop
        const edge = Math.min(u / 0.16, (1 - u) / 0.18, 1);
        g.scale.setScalar(Math.max(0.001, edge));
      });
    }
  });

  if (season === "spring") {
    const colors = ["#ff9ec8", "#ffe078", "#9cd8ff"];
    return (
      <group>
        {colors.map((col, i) => (
          <group
            key={i}
            ref={(el) => {
              butterflyRefs.current[i] = el;
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.002, 0.002, 0.018, 5]} />
              <BrightMat color="#4a3d5c" boost={0.2} />
            </mesh>
            <mesh
              ref={(el) => {
                wingLRefs.current[i] = el;
              }}
              position={[-0.012, 0, 0]}
            >
              <boxGeometry args={[0.022, 0.002, 0.016]} />
              <BrightMat color={col} boost={0.5} />
            </mesh>
            <mesh
              ref={(el) => {
                wingRRefs.current[i] = el;
              }}
              position={[0.012, 0, 0]}
            >
              <boxGeometry args={[0.022, 0.002, 0.016]} />
              <BrightMat color={col} boost={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (season === "summer") {
    return (
      <group>
        {[0, 1].map((i) => (
          <group
            key={i}
            ref={(el) => {
              dragonflyRefs.current[i] = el;
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0025, 0.0018, 0.036, 6]} />
              <BrightMat color="#36c7b8" boost={0.48} />
            </mesh>
            <mesh position={[0, 0.002, 0.004]}>
              <boxGeometry args={[0.044, 0.0015, 0.007]} />
              <BrightMat color="#e0faff" boost={0.55} opacity={0.78} />
            </mesh>
            <mesh position={[0, 0.002, -0.004]}>
              <boxGeometry args={[0.034, 0.0015, 0.006]} />
              <BrightMat color="#e0faff" boost={0.55} opacity={0.78} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (season === "autumn") {
    const vOffsets: [number, number, number][] = [
      [0, 0, 0],
      [-0.056, 0.012, -0.042],
      [0.056, -0.008, -0.042],
      [-0.112, 0.022, -0.084],
      [0.112, -0.014, -0.084],
    ];
    return (
      <group ref={geeseGroupRef}>
        {vOffsets.map(([gx, gy, gz], i) => (
          <group key={i} position={[gx, gy, gz]}>
            {/* Teardrop storybook goose body + soft cream chest */}
            <mesh scale={[0.0068, 0.0056, 0.0155]} material={gooseMats.body}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
            <mesh position={[0, -0.0022, 0.003]} scale={[0.0054, 0.0042, 0.011]} material={gooseMats.chest}>
              <sphereGeometry args={[1, 8, 8]} />
            </mesh>

            {/* Graceful outstretched slender neck */}
            <mesh position={[0, 0.0025, 0.0175]} rotation={[Math.PI / 2 - 0.16, 0, 0]} material={gooseMats.neck}>
              <cylinderGeometry args={[0.0022, 0.003, 0.016, 7]} />
            </mesh>

            {/* Round head + subtle white cheek + warm orange beak */}
            <mesh position={[0, 0.0042, 0.0255]} material={gooseMats.head}>
              <sphereGeometry args={[0.0036, 8, 8]} />
            </mesh>
            <mesh position={[0, 0.0036, 0.0258]} scale={[1.08, 0.55, 0.7]} material={gooseMats.cheek}>
              <sphereGeometry args={[0.0034, 6, 6]} />
            </mesh>
            <mesh position={[0, 0.0038, 0.0298]} scale={[0.0018, 0.0014, 0.0036]} material={gooseMats.beak}>
              <sphereGeometry args={[1, 6, 6]} />
            </mesh>

            {/* Fanned tail feathers */}
            <mesh position={[0, 0.0005, -0.0165]} scale={[0.0065, 0.0016, 0.0075]} material={gooseMats.tail}>
              <sphereGeometry args={[1, 6, 6]} />
            </mesh>

            {/* Right articulated 2-segment curved feather wing (+X) */}
            <group
              ref={(el) => {
                gooseWingRRefs.current[i] = el;
              }}
              position={[0.0045, 0.0015, 0.001]}
            >
              <mesh geometry={GOOSE_WING_INNER_GEO} material={gooseMats.wingInner} />
              <mesh
                ref={(el) => {
                  gooseTipRRefs.current[i] = el;
                }}
                geometry={GOOSE_WING_OUTER_GEO}
                position={[0.021, 0, 0]}
                material={gooseMats.wingOuter}
              />
            </group>

            {/* Left articulated 2-segment curved feather wing (-X, mirrored) */}
            <group
              ref={(el) => {
                gooseWingLRefs.current[i] = el;
              }}
              position={[-0.0045, 0.0015, 0.001]}
            >
              <mesh geometry={GOOSE_WING_INNER_GEO} scale={[-1, 1, 1]} material={gooseMats.wingInner} />
              <mesh
                ref={(el) => {
                  gooseTipLRefs.current[i] = el;
                }}
                geometry={GOOSE_WING_OUTER_GEO}
                position={[-0.021, 0, 0]}
                scale={[-1, 1, 1]}
                material={gooseMats.wingOuter}
              />
            </group>
          </group>
        ))}
      </group>
    );
  }

  // WINTER: 3 Glowing Floating Sky Lanterns (孔明灯)
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(el) => {
            skyLanternRefs.current[i] = el;
          }}
        >
          <mesh>
            <cylinderGeometry args={[0.018, 0.012, 0.036, 8]} />
            <meshBasicMaterial color="#ffdf94" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.038, 10, 10]} />
            <meshBasicMaterial color="#ffc866" transparent opacity={0.26} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
