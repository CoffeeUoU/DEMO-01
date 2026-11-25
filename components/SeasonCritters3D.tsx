"use client";

import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import type { Season } from "./SeasonTree3D";
import { getTerrainY } from "./SeasonGroundCover3D";

function CuteMat({ color, boost = 0.34, opacity = 1 }: { color: string; boost?: number; opacity?: number }) {
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

/** Glossy storybook eye with crisp white specular catchlight */
function GlossyEye({ pos, radius = 0.0028 }: { pos: [number, number, number]; radius?: number }) {
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[radius, 12, 10]} />
        <meshBasicMaterial color="#36273d" />
      </mesh>
      <mesh position={[radius * 0.32, radius * 0.34, radius * 0.72]}>
        <sphereGeometry args={[radius * 0.34, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export default function SeasonCritters3D({ season }: { season: Season }) {
  const hopRef = useRef(0);
  const bunnyRef = useRef<THREE.Group>(null);
  const earLRef = useRef<THREE.Group>(null);
  const earRRef = useRef<THREE.Group>(null);

  const frogRef = useRef<THREE.Group>(null);
  const koi1Ref = useRef<THREE.Group>(null);
  const koi2Ref = useRef<THREE.Group>(null);
  const koiTail1Ref = useRef<THREE.Mesh>(null);
  const koiTail2Ref = useRef<THREE.Mesh>(null);

  const squirrelRef = useRef<THREE.Group>(null);
  const sqTailRef = useRef<THREE.Group>(null);

  const kittyRef = useRef<THREE.Group>(null);
  const kittyTailRef = useRef<THREE.Group>(null);
  const heartRef = useRef<THREE.Mesh>(null);

  const triggerHop = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    hopRef.current = 1.2;
  };

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, delta);
    if (hopRef.current > 0) hopRef.current = Math.max(0, hopRef.current - dt);
    const h = hopRef.current;

    if (season === "spring" && bunnyRef.current) {
      const baseY = getTerrainY("spring", -0.17, 0.14);
      const jump = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2.5)) * 0.044 : Math.abs(Math.sin(t * 2.2)) * 0.003;
      bunnyRef.current.position.y = baseY + jump;
      const earWig = Math.sin(t * 3.2) * 0.10 + (h > 0 ? Math.sin(h * 18) * 0.32 : 0);
      if (earLRef.current) earLRef.current.rotation.z = 0.22 + earWig;
      if (earRRef.current) earRRef.current.rotation.z = -0.22 - earWig;
    }

    if (season === "summer") {
      if (frogRef.current) {
        const jump = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2)) * 0.048 : 0;
        frogRef.current.position.y = 0.029 + jump;
        frogRef.current.scale.y = h > 0 ? 1 + Math.sin(h * Math.PI * 4) * 0.16 : 1 + Math.sin(t * 3.0) * 0.04;
      }
      // 2 sculpted mini koi fish gracefully swimming with swishing tails in the lotus pond [0.24, 0.023, 0.18]
      if (koi1Ref.current) {
        const a = t * 0.85;
        const x = 0.24 + Math.cos(a) * 0.068;
        const z = 0.18 + Math.sin(a) * 0.046;
        koi1Ref.current.position.set(x, 0.023, z);
        koi1Ref.current.rotation.y = Math.atan2(-Math.sin(a) * 0.068, Math.cos(a) * 0.046);
      }
      if (koi2Ref.current) {
        const a = -t * 0.72 + 2.4;
        const x = 0.24 + Math.cos(a) * 0.048;
        const z = 0.18 + Math.sin(a) * 0.036;
        koi2Ref.current.position.set(x, 0.023, z);
        koi2Ref.current.rotation.y = Math.atan2(Math.sin(a) * 0.048, -Math.cos(a) * 0.036);
      }
      if (koiTail1Ref.current) koiTail1Ref.current.rotation.y = Math.sin(t * 9.5) * 0.38;
      if (koiTail2Ref.current) koiTail2Ref.current.rotation.y = Math.sin(t * 8.6 + 1.5) * 0.38;
    }

    if (season === "autumn" && squirrelRef.current) {
      const baseY = getTerrainY("autumn", 0.14, 0.14);
      const jump = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2.2)) * 0.045 : 0;
      squirrelRef.current.position.y = baseY + jump;
      squirrelRef.current.rotation.y = -0.65 + (h > 0 ? (1.2 - h) * Math.PI * 1.6 : Math.sin(t * 1.4) * 0.10);
      if (sqTailRef.current) {
        sqTailRef.current.rotation.x = -0.15 + Math.sin(t * 4.8 + h * 14) * 0.16;
      }
    }

    if (season === "winter" && kittyRef.current) {
      const baseY = getTerrainY("winter", -0.22, 0.12) + 0.004;
      const bounce = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2)) * 0.028 : 0;
      kittyRef.current.position.y = baseY + bounce;
      if (kittyTailRef.current) {
        kittyTailRef.current.rotation.y = Math.sin(t * 2.2 + h * 10) * 0.28;
      }
      if (heartRef.current) {
        if (h > 0) {
          const u = 1 - h / 1.2;
          heartRef.current.visible = true;
          heartRef.current.position.y = 0.070 + u * 0.055;
          heartRef.current.scale.setScalar((1 - u * 0.4) * 0.012);
        } else {
          heartRef.current.visible = false;
        }
      }
    }
  });

  if (season === "spring") {
    const y0 = getTerrainY("spring", -0.17, 0.14);
    return (
      <group ref={bunnyRef} position={[-0.17, y0, 0.14]} rotation={[0, 0.55, 0]} onClick={triggerHop}>
        {/* Seated plump pear-shaped cream bunny body */}
        <mesh position={[0, 0.022, -0.002]} scale={[0.96, 1.02, 1.12]}>
          <sphereGeometry args={[0.023, 18, 14]} />
          <CuteMat color="#fff6ee" boost={0.36} />
        </mesh>
        {/* Soft white chest fluff */}
        <mesh position={[0, 0.025, 0.014]} scale={[0.78, 0.86, 0.65]}>
          <sphereGeometry args={[0.017, 14, 12]} />
          <CuteMat color="#ffffff" boost={0.44} />
        </mesh>
        {/* Seated hind haunches & cute little feet firmly on the grass */}
        {[-1, 1].map((s) => (
          <group key={`hind-${s}`}>
            <mesh position={[s * 0.016, 0.014, -0.006]} scale={[0.68, 0.82, 0.92]}>
              <sphereGeometry args={[0.013, 12, 10]} />
              <CuteMat color="#ffefe4" boost={0.34} />
            </mesh>
            <mesh position={[s * 0.015, 0.005, 0.010]} scale={[0.65, 0.42, 1.15]}>
              <sphereGeometry args={[0.010, 12, 10]} />
              <CuteMat color="#fff9f4" boost={0.40} />
            </mesh>
          </group>
        ))}
        {/* Two dainty tucked front paws */}
        {[-1, 1].map((s) => (
          <mesh key={`paw-${s}`} position={[s * 0.009, 0.017, 0.021]} rotation={[0.3, 0, s * -0.15]} scale={[0.62, 0.85, 0.72]}>
            <sphereGeometry args={[0.0075, 12, 10]} />
            <CuteMat color="#ffffff" boost={0.42} />
          </mesh>
        ))}
        {/* Multi-puff fluffy cotton-ball tail */}
        <group position={[0, 0.016, -0.026]}>
          <mesh>
            <sphereGeometry args={[0.011, 12, 10]} />
            <CuteMat color="#ffffff" boost={0.48} />
          </mesh>
          <mesh position={[-0.005, 0.004, -0.002]}>
            <sphereGeometry args={[0.007, 10, 8]} />
            <CuteMat color="#ffffff" boost={0.48} />
          </mesh>
          <mesh position={[0.005, 0.003, -0.002]}>
            <sphereGeometry args={[0.007, 10, 8]} />
            <CuteMat color="#ffffff" boost={0.48} />
          </mesh>
        </group>

        {/* Pastel sakura ribbon collar + tiny golden bell */}
        <mesh position={[0, 0.036, 0.006]} rotation={[Math.PI / 2 + 0.22, 0, 0]}>
          <torusGeometry args={[0.0155, 0.0032, 8, 18]} />
          <CuteMat color="#ff9ec2" boost={0.40} />
        </mesh>
        <mesh position={[0, 0.032, 0.022]}>
          <sphereGeometry args={[0.0042, 10, 10]} />
          <CuteMat color="#ffe078" boost={0.48} />
        </mesh>

        {/* Expressive chubby-cheeked storybook head */}
        <group position={[0, 0.050, 0.010]}>
          <mesh scale={[1.05, 0.96, 1.0]}>
            <sphereGeometry args={[0.019, 18, 14]} />
            <CuteMat color="#fff8f2" boost={0.38} />
          </mesh>
          {/* Chubby lower cheeks */}
          {[-1, 1].map((s) => (
            <mesh key={`chk-${s}`} position={[s * 0.011, -0.005, 0.011]} scale={[0.92, 0.78, 0.72]}>
              <sphereGeometry args={[0.0095, 12, 10]} />
              <CuteMat color="#fffaf5" boost={0.40} />
            </mesh>
          ))}
          {/* Rosy pastel blush */}
          {[-1, 1].map((s) => (
            <mesh key={`blush-${s}`} position={[s * 0.013, -0.003, 0.0155]} scale={[1.2, 0.75, 0.4]}>
              <sphereGeometry args={[0.0036, 10, 8]} />
              <CuteMat color="#ffb2cc" boost={0.44} />
            </mesh>
          ))}
          {/* Glossy eyes with white catchlights */}
          <GlossyEye pos={[-0.0082, 0.0025, 0.0168]} radius={0.0030} />
          <GlossyEye pos={[0.0082, 0.0025, 0.0168]} radius={0.0030} />
          {/* Cute button pink nose */}
          <mesh position={[0, -0.0025, 0.0195]} scale={[1.25, 0.88, 0.75]}>
            <sphereGeometry args={[0.0028, 10, 8]} />
            <CuteMat color="#ff85a8" boost={0.44} />
          </mesh>

          {/* Sculpted two-tone bunny ears (cream outer + recessed sakura inner) */}
          <group ref={earLRef} position={[-0.010, 0.015, -0.001]} rotation={[0.08, 0.15, 0.22]}>
            <mesh position={[0, 0.015, 0]} scale={[0.48, 1.48, 0.34]}>
              <sphereGeometry args={[0.013, 14, 12]} />
              <CuteMat color="#fff6ee" boost={0.38} />
            </mesh>
            <mesh position={[0, 0.014, 0.0028]} scale={[0.32, 1.18, 0.18]}>
              <sphereGeometry args={[0.012, 12, 10]} />
              <CuteMat color="#ffb8d2" boost={0.44} />
            </mesh>
          </group>
          <group ref={earRRef} position={[0.010, 0.015, -0.001]} rotation={[0.08, -0.15, -0.22]}>
            <mesh position={[0, 0.015, 0]} scale={[0.48, 1.48, 0.34]}>
              <sphereGeometry args={[0.013, 14, 12]} />
              <CuteMat color="#fff6ee" boost={0.38} />
            </mesh>
            <mesh position={[0, 0.014, 0.0028]} scale={[0.32, 1.18, 0.18]}>
              <sphereGeometry args={[0.012, 12, 10]} />
              <CuteMat color="#ffb8d2" boost={0.44} />
            </mesh>
          </group>
        </group>

        {/* Adorable miniature carrot resting right beside the bunny's paws */}
        <group position={[0.028, 0.006, 0.022]} rotation={[0, -0.45, Math.PI / 2 - 0.12]}>
          <mesh>
            <coneGeometry args={[0.0062, 0.026, 10]} />
            <CuteMat color="#ff8f48" boost={0.40} />
          </mesh>
          <mesh position={[0, -0.015, 0]} rotation={[0, 0, 0.25]}>
            <coneGeometry args={[0.0038, 0.010, 6]} />
            <CuteMat color="#6ed16e" boost={0.38} />
          </mesh>
          <mesh position={[0.002, -0.015, 0.002]} rotation={[0.25, 0, -0.25]}>
            <coneGeometry args={[0.0032, 0.009, 6]} />
            <CuteMat color="#8ae37c" boost={0.40} />
          </mesh>
        </group>
      </group>
    );
  }

  if (season === "summer") {
    return (
      <group>
        {/* Refined Chubby Storybook Pond Frog sitting on the lily pad */}
        <group ref={frogRef} position={[0.21, 0.029, 0.20]} rotation={[0, -0.6, 0]} onClick={triggerHop}>
          {/* Plump emerald body */}
          <mesh position={[0, 0.012, 0]} scale={[1.18, 0.80, 1.08]}>
            <sphereGeometry args={[0.016, 16, 14]} />
            <CuteMat color="#66d468" boost={0.38} />
          </mesh>
          {/* Creamy pastel belly */}
          <mesh position={[0, 0.008, 0.006]} scale={[0.92, 0.58, 0.82]}>
            <sphereGeometry args={[0.014, 14, 12]} />
            <CuteMat color="#e2fab0" boost={0.44} />
          </mesh>
          {/* Sculpted hind legs & webbed feet */}
          {[-1, 1].map((s) => (
            <group key={`fleg-${s}`}>
              <mesh position={[s * 0.016, 0.007, -0.004]} rotation={[0.2, s * 0.4, 0]} scale={[0.62, 0.56, 1.05]}>
                <sphereGeometry args={[0.0095, 10, 8]} />
                <CuteMat color="#56c25b" boost={0.34} />
              </mesh>
              <mesh position={[s * 0.017, 0.002, 0.008]} scale={[0.9, 0.28, 1.1]}>
                <sphereGeometry args={[0.0065, 8, 8]} />
                <CuteMat color="#76de72" boost={0.38} />
              </mesh>
              <mesh position={[s * 0.010, 0.005, 0.014]} scale={[0.55, 0.72, 0.6]}>
                <sphereGeometry args={[0.0052, 8, 8]} />
                <CuteMat color="#66d468" boost={0.38} />
              </mesh>
            </group>
          ))}
          {/* Raised big frog eye domes with glossy pupils + white catchlights */}
          {[-0.0088, 0.0088].map((ex, i) => (
            <group key={i} position={[ex, 0.023, 0.006]}>
              <mesh>
                <sphereGeometry args={[0.0068, 12, 10]} />
                <CuteMat color="#72dc70" boost={0.38} />
              </mesh>
              <mesh position={[0, 0.0005, 0.0028]}>
                <sphereGeometry args={[0.0052, 12, 10]} />
                <CuteMat color="#ffffff" boost={0.50} />
              </mesh>
              <GlossyEye pos={[0, 0.0008, 0.0062]} radius={0.0028} />
            </group>
          ))}
          {/* Rosy blush cheeks */}
          {[-1, 1].map((s) => (
            <mesh key={`fbl-${s}`} position={[s * 0.012, 0.013, 0.012]} scale={[1.15, 0.7, 0.4]}>
              <sphereGeometry args={[0.0034, 8, 8]} />
              <CuteMat color="#ffa6c0" boost={0.44} />
            </mesh>
          ))}
          {/* Cute tiny pink lotus bud crown on top of its head */}
          <mesh position={[0, 0.026, -0.001]}>
            <coneGeometry args={[0.0055, 0.009, 7]} />
            <CuteMat color="#ffb4d0" boost={0.46} />
          </mesh>
        </group>

        {/* 2 Sculpted Calico Mini Koi Fish with swishing forked tails */}
        {[
          { ref: koi1Ref, tailRef: koiTail1Ref, col: "#ff6b52", spot: "#ffffff" },
          { ref: koi2Ref, tailRef: koiTail2Ref, col: "#ffa84c", spot: "#fff6e6" },
        ].map((fish, idx) => (
          <group key={idx} ref={fish.ref}>
            <mesh scale={[0.58, 0.48, 1.45]}>
              <sphereGeometry args={[0.011, 14, 10]} />
              <CuteMat color={fish.col} boost={0.44} />
            </mesh>
            <mesh position={[0, 0.0022, 0.004]} scale={[0.50, 0.36, 0.68]}>
              <sphereGeometry args={[0.0085, 10, 8]} />
              <CuteMat color={fish.spot} boost={0.50} />
            </mesh>
            {/* Tiny side pectoral fins */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.0065, -0.001, 0.002]} rotation={[0, s * 0.55, s * 0.2]} scale={[0.9, 0.16, 0.45]}>
                <sphereGeometry args={[0.006, 8, 6]} />
                <CuteMat color={fish.spot} boost={0.46} opacity={0.85} />
              </mesh>
            ))}
            {/* Swishing caudal tail fin */}
            <mesh ref={fish.tailRef} position={[0, 0, -0.016]} scale={[0.24, 0.68, 0.95]}>
              <coneGeometry args={[0.009, 0.016, 6]} />
              <CuteMat color={fish.col} boost={0.44} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (season === "autumn") {
    const y0 = getTerrainY("autumn", 0.14, 0.14);
    return (
      <group ref={squirrelRef} position={[0.14, y0, 0.14]} rotation={[0, -0.65, 0]} onClick={triggerHop}>
        {/* Chestnut squirrel body + soft cream belly */}
        <mesh position={[0, 0.021, 0]} scale={[0.90, 1.12, 0.96]}>
          <sphereGeometry args={[0.019, 16, 14]} />
          <CuteMat color="#c77542" boost={0.34} />
        </mesh>
        <mesh position={[0, 0.019, 0.009]} scale={[0.68, 0.86, 0.62]}>
          <sphereGeometry args={[0.0155, 14, 12]} />
          <CuteMat color="#faebd2" boost={0.40} />
        </mesh>
        {/* Seated hind haunches & little feet */}
        {[-1, 1].map((s) => (
          <group key={`sqf-${s}`}>
            <mesh position={[s * 0.013, 0.012, -0.003]} scale={[0.65, 0.8, 0.9]}>
              <sphereGeometry args={[0.011, 10, 8]} />
              <CuteMat color="#bd6c3b" boost={0.32} />
            </mesh>
            <mesh position={[s * 0.012, 0.004, 0.010]} scale={[0.6, 0.38, 1.05]}>
              <sphereGeometry args={[0.008, 10, 8]} />
              <CuteMat color="#d9874e" boost={0.34} />
            </mesh>
            {/* Front paws clasping the acorn */}
            <mesh position={[s * 0.0075, 0.024, 0.019]} scale={[0.55, 0.65, 0.8]}>
              <sphereGeometry args={[0.006, 10, 8]} />
              <CuteMat color="#d9874e" boost={0.36} />
            </mesh>
          </group>
        ))}

        {/* Expressive chubby-cheeked squirrel head */}
        <group position={[0, 0.044, 0.009]}>
          <mesh scale={[1.05, 0.96, 1.0]}>
            <sphereGeometry args={[0.015, 16, 14]} />
            <CuteMat color="#d48048" boost={0.36} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={`sqc-${s}`} position={[s * 0.0095, -0.004, 0.0085]} scale={[0.88, 0.72, 0.68]}>
              <sphereGeometry args={[0.0078, 12, 10]} />
              <CuteMat color="#f7e2c4" boost={0.38} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`sqb-${s}`} position={[s * 0.011, -0.002, 0.012]} scale={[1.1, 0.7, 0.4]}>
              <sphereGeometry args={[0.0030, 8, 8]} />
              <CuteMat color="#ff9ea8" boost={0.42} />
            </mesh>
          ))}
          {/* Two-tone rounded ears */}
          {[-1, 1].map((s) => (
            <group key={`sqe-${s}`} position={[s * 0.010, 0.013, -0.002]} rotation={[0, 0, s * -0.22]}>
              <mesh scale={[0.75, 1.12, 0.55]}>
                <sphereGeometry args={[0.0062, 10, 8]} />
                <CuteMat color="#c77542" boost={0.34} />
              </mesh>
              <mesh position={[0, 0, 0.002]} scale={[0.48, 0.78, 0.3]}>
                <sphereGeometry args={[0.0052, 8, 8]} />
                <CuteMat color="#fae5c8" boost={0.40} />
              </mesh>
            </group>
          ))}
          <GlossyEye pos={[-0.0066, 0.0022, 0.0134]} radius={0.0026} />
          <GlossyEye pos={[0.0066, 0.0022, 0.0134]} radius={0.0026} />
          <mesh position={[0, -0.0018, 0.0155]} scale={[1.15, 0.85, 0.75]}>
            <sphereGeometry args={[0.0022, 8, 8]} />
            <CuteMat color="#4a2e28" boost={0.22} />
          </mesh>
        </group>

        {/* Detailed two-piece acorn held in paws */}
        <group position={[0, 0.025, 0.024]} rotation={[0.25, 0, 0]}>
          <mesh scale={[0.88, 1.12, 0.88]}>
            <sphereGeometry args={[0.0072, 12, 10]} />
            <CuteMat color="#b5713c" boost={0.34} />
          </mesh>
          <mesh position={[0, 0.0055, 0]} scale={[1.05, 0.62, 1.05]}>
            <sphereGeometry args={[0.0076, 12, 10]} />
            <CuteMat color="#6e4229" boost={0.26} />
          </mesh>
          <mesh position={[0, 0.0105, 0]}>
            <cylinderGeometry args={[0.0012, 0.0015, 0.005, 6]} />
            <CuteMat color="#593420" boost={0.24} />
          </mesh>
        </group>

        {/* Lush 4-puff S-curved fluffy squirrel tail */}
        <group ref={sqTailRef} position={[0, 0.018, -0.018]}>
          <mesh position={[0, 0.008, -0.006]} scale={[0.82, 1.05, 0.88]}>
            <sphereGeometry args={[0.013, 12, 10]} />
            <CuteMat color="#cf7d46" boost={0.34} />
          </mesh>
          <mesh position={[0, 0.024, -0.012]} scale={[0.86, 1.25, 0.92]}>
            <sphereGeometry args={[0.016, 14, 12]} />
            <CuteMat color="#de8c52" boost={0.36} />
          </mesh>
          <mesh position={[0, 0.042, -0.007]} scale={[0.82, 1.05, 0.86]}>
            <sphereGeometry args={[0.015, 14, 12]} />
            <CuteMat color="#eb9e62" boost={0.38} />
          </mesh>
          <mesh position={[0, 0.052, 0.003]} scale={[0.76, 0.82, 0.78]}>
            <sphereGeometry args={[0.012, 12, 10]} />
            <CuteMat color="#faebd2" boost={0.42} />
          </mesh>
        </group>
      </group>
    );
  }

  // WINTER: Refined Cozy Curled Ginger Tabby Kitty with Scarf & Tabby Stripes
  const y0 = getTerrainY("winter", -0.22, 0.12) + 0.004;
  return (
    <group ref={kittyRef} position={[-0.22, y0, 0.12]} rotation={[0, -0.9, 0]} onClick={triggerHop}>
      {/* Curled cozy ginger body */}
      <mesh position={[0, 0.016, 0]} scale={[1.26, 0.76, 1.08]}>
        <sphereGeometry args={[0.023, 18, 14]} />
        <CuteMat color="#f5a55c" boost={0.32} />
      </mesh>
      {/* Subtle warm ginger tabby stripes across the back */}
      {[-0.009, 0.0, 0.009].map((sx, i) => (
        <mesh key={i} position={[sx, 0.028, -0.004]} rotation={[0, 0.15, 0]} scale={[0.24, 0.45, 0.88]}>
          <sphereGeometry args={[0.014, 10, 8]} />
          <CuteMat color="#d97f3b" boost={0.28} />
        </mesh>
      ))}
      {/* Tucked cute white mittens (paws) */}
      {[-0.007, 0.009].map((px, i) => (
        <mesh key={i} position={[px + 0.014, 0.007, 0.022]} scale={[0.85, 0.55, 1.0]}>
          <sphereGeometry args={[0.0068, 10, 8]} />
          <CuteMat color="#fff8f0" boost={0.40} />
        </mesh>
      ))}
      {/* Cozy knitted red winter scarf around kitty's neck */}
      <mesh position={[0.013, 0.021, 0.012]} rotation={[Math.PI / 2 + 0.28, 0, -0.2]}>
        <torusGeometry args={[0.0135, 0.0038, 8, 16]} />
        <CuteMat color="#f06472" boost={0.36} />
      </mesh>

      {/* Round kitty head + chubby white muzzle + pink nose */}
      <group position={[0.015, 0.032, 0.013]}>
        <mesh scale={[1.08, 0.96, 1.0]}>
          <sphereGeometry args={[0.016, 18, 14]} />
          <CuteMat color="#f7b06b" boost={0.34} />
        </mesh>
        <mesh position={[0.001, -0.004, 0.011]} scale={[1.12, 0.74, 0.68]}>
          <sphereGeometry args={[0.0095, 14, 10]} />
          <CuteMat color="#fff7ee" boost={0.40} />
        </mesh>
        {/* Tiny pink triangle nose */}
        <mesh position={[0.001, -0.0025, 0.0172]} scale={[1.1, 0.8, 0.6]}>
          <sphereGeometry args={[0.0024, 8, 8]} />
          <CuteMat color="#ff8ba8" boost={0.44} />
        </mesh>
        {/* Rosy blush cheeks */}
        {[-1, 1].map((s) => (
          <mesh key={`kbl-${s}`} position={[0.001 + s * 0.010, -0.003, 0.013]} scale={[1.15, 0.7, 0.4]}>
            <sphereGeometry args={[0.0032, 8, 8]} />
            <CuteMat color="#ff9eb8" boost={0.42} />
          </mesh>
        ))}
        {/* Two-tone triangular kitty ears with soft pink inner ear */}
        {[-1, 1].map((s) => (
          <group key={`ke-${s}`} position={[s * 0.009, 0.014, -0.001]} rotation={[0, 0, s * -0.24]}>
            <mesh>
              <coneGeometry args={[0.0062, 0.013, 6]} />
              <CuteMat color="#f0984c" boost={0.32} />
            </mesh>
            <mesh position={[0, -0.001, 0.0022]} scale={[0.58, 0.68, 0.45]}>
              <coneGeometry args={[0.0055, 0.011, 5]} />
              <CuteMat color="#ffb8cc" boost={0.42} />
            </mesh>
          </group>
        ))}
        {/* Happy curved sleeping eyes */}
        {[-0.0058, 0.0076].map((ex, i) => (
          <mesh key={i} position={[ex, 0.0015, 0.0148]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.0032, 0.00085, 6, 12, Math.PI]} />
            <meshBasicMaterial color="#3c2b36" />
          </mesh>
        ))}
      </group>

      {/* Curved swaying white-tipped tabby tail */}
      <group ref={kittyTailRef} position={[-0.022, 0.012, 0.006]}>
        <mesh position={[0, 0.002, 0.006]} rotation={[0.4, 0.3, Math.PI / 2 - 0.25]} scale={[0.58, 1.35, 0.58]}>
          <sphereGeometry args={[0.010, 12, 10]} />
          <CuteMat color="#f09a4e" boost={0.32} />
        </mesh>
        <mesh position={[0.006, 0.005, 0.016]} scale={[0.72, 0.72, 0.95]}>
          <sphereGeometry args={[0.0075, 10, 8]} />
          <CuteMat color="#fff6eb" boost={0.40} />
        </mesh>
      </group>

      {/* Floating happy pink heart on click */}
      <mesh ref={heartRef} position={[0.015, 0.070, 0.012]} visible={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ff7ca3" />
      </mesh>
    </group>
  );
}
