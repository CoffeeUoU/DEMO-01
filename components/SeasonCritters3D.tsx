"use client";

import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import type { Season } from "./SeasonTree3D";
import { getTerrainY } from "./SeasonGroundCover3D";

function CuteMat({ color, boost = 0.36, opacity = 1 }: { color: string; boost?: number; opacity?: number }) {
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

export default function SeasonCritters3D({ season }: { season: Season }) {
  const hopRef = useRef(0);
  const bunnyRef = useRef<THREE.Group>(null);
  const earLRef = useRef<THREE.Mesh>(null);
  const earRRef = useRef<THREE.Mesh>(null);

  const frogRef = useRef<THREE.Group>(null);
  const koi1Ref = useRef<THREE.Group>(null);
  const koi2Ref = useRef<THREE.Group>(null);

  const squirrelRef = useRef<THREE.Group>(null);
  const sqTailRef = useRef<THREE.Group>(null);

  const kittyRef = useRef<THREE.Group>(null);
  const kittyTailRef = useRef<THREE.Mesh>(null);
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
      const jump = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2.5)) * 0.042 : Math.abs(Math.sin(t * 2.2)) * 0.004;
      bunnyRef.current.position.y = baseY + jump;
      const earWig = Math.sin(t * 3.8) * 0.12 + (h > 0 ? Math.sin(h * 18) * 0.35 : 0);
      if (earLRef.current) earLRef.current.rotation.z = 0.25 + earWig;
      if (earRRef.current) earRRef.current.rotation.z = -0.25 - earWig;
    }

    if (season === "summer") {
      if (frogRef.current) {
        const jump = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2)) * 0.048 : 0;
        frogRef.current.position.y = 0.022 + jump;
        frogRef.current.scale.y = h > 0 ? 1 + Math.sin(h * Math.PI * 4) * 0.18 : 1 + Math.sin(t * 3.2) * 0.05;
      }
      // 2 mini koi fish gracefully swimming in the lotus pond [0.24, 0.015, 0.18]
      if (koi1Ref.current) {
        const a = t * 0.85;
        const x = 0.24 + Math.cos(a) * 0.068;
        const z = 0.18 + Math.sin(a) * 0.046;
        koi1Ref.current.position.set(x, 0.016, z);
        koi1Ref.current.rotation.y = Math.atan2(-Math.sin(a) * 0.068, Math.cos(a) * 0.046);
      }
      if (koi2Ref.current) {
        const a = -t * 0.72 + 2.4;
        const x = 0.24 + Math.cos(a) * 0.048;
        const z = 0.18 + Math.sin(a) * 0.036;
        koi2Ref.current.position.set(x, 0.016, z);
        koi2Ref.current.rotation.y = Math.atan2(Math.sin(a) * 0.048, -Math.cos(a) * 0.036);
      }
    }

    if (season === "autumn" && squirrelRef.current) {
      const baseY = getTerrainY("autumn", 0.14, 0.14);
      const jump = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2.2)) * 0.045 : 0;
      squirrelRef.current.position.y = baseY + jump;
      squirrelRef.current.rotation.y = -0.65 + (h > 0 ? (1.2 - h) * Math.PI * 1.6 : Math.sin(t * 1.4) * 0.12);
      if (sqTailRef.current) {
        sqTailRef.current.rotation.x = -0.2 + Math.sin(t * 5.2 + h * 14) * 0.18;
      }
    }

    if (season === "winter" && kittyRef.current) {
      const baseY = getTerrainY("winter", -0.26, 0.10);
      const bounce = h > 0 ? Math.abs(Math.sin(h * Math.PI * 2)) * 0.028 : 0;
      kittyRef.current.position.y = baseY + bounce;
      if (kittyTailRef.current) {
        kittyTailRef.current.rotation.y = Math.sin(t * 2.4 + h * 10) * 0.35;
      }
      if (heartRef.current) {
        if (h > 0) {
          const u = 1 - h / 1.2;
          heartRef.current.visible = true;
          heartRef.current.position.y = 0.068 + u * 0.055;
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
        {/* Plump cream bunny body */}
        <mesh position={[0, 0.022, 0]} scale={[1, 0.9, 1.15]}>
          <sphereGeometry args={[0.022, 12, 10]} />
          <CuteMat color="#fff8f0" boost={0.40} />
        </mesh>
        {/* Fluffy cotton tail */}
        <mesh position={[0, 0.018, -0.026]}>
          <sphereGeometry args={[0.010, 8, 8]} />
          <CuteMat color="#ffffff" boost={0.48} />
        </mesh>
        {/* Round cute head */}
        <mesh position={[0, 0.044, 0.014]}>
          <sphereGeometry args={[0.017, 12, 10]} />
          <CuteMat color="#fff8f0" boost={0.40} />
        </mesh>
        {/* Floppy ears */}
        <mesh ref={earLRef} position={[-0.013, 0.055, 0.010]} rotation={[0.1, 0, 0.25]} scale={[0.45, 1.35, 0.32]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <CuteMat color="#ffe6ee" boost={0.42} />
        </mesh>
        <mesh ref={earRRef} position={[0.013, 0.055, 0.010]} rotation={[0.1, 0, -0.25]} scale={[0.45, 1.35, 0.32]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <CuteMat color="#ffe6ee" boost={0.42} />
        </mesh>
        {/* Tiny eyes & pink nose */}
        <mesh position={[-0.007, 0.047, 0.029]}>
          <sphereGeometry args={[0.0024, 6, 6]} />
          <meshBasicMaterial color="#3c2e45" />
        </mesh>
        <mesh position={[0.007, 0.047, 0.029]}>
          <sphereGeometry args={[0.0024, 6, 6]} />
          <meshBasicMaterial color="#3c2e45" />
        </mesh>
        <mesh position={[0, 0.042, 0.031]}>
          <sphereGeometry args={[0.0026, 6, 6]} />
          <CuteMat color="#ff92b0" boost={0.44} />
        </mesh>
      </group>
    );
  }

  if (season === "summer") {
    return (
      <group>
        {/* Cute Emerald Frog sitting on the lily pad */}
        <group ref={frogRef} position={[0.21, 0.022, 0.20]} rotation={[0, -0.6, 0]} onClick={triggerHop}>
          <mesh position={[0, 0.011, 0]} scale={[1.15, 0.78, 1.05]}>
            <sphereGeometry args={[0.015, 10, 10]} />
            <CuteMat color="#6cd96c" boost={0.40} />
          </mesh>
          <mesh position={[0, 0.008, 0.004]} scale={[0.9, 0.55, 0.85]}>
            <sphereGeometry args={[0.013, 8, 8]} />
            <CuteMat color="#d8f7a6" boost={0.44} />
          </mesh>
          {/* Big cute frog eyes */}
          {[-0.008, 0.008].map((ex, i) => (
            <group key={i} position={[ex, 0.022, 0.007]}>
              <mesh>
                <sphereGeometry args={[0.0052, 8, 8]} />
                <CuteMat color="#ffffff" boost={0.50} />
              </mesh>
              <mesh position={[0, 0.001, 0.004]}>
                <sphereGeometry args={[0.0025, 6, 6]} />
                <meshBasicMaterial color="#2a2438" />
              </mesh>
            </group>
          ))}
        </group>

        {/* 2 Swimming Red-and-White Mini Koi Fish in the pond */}
        {[
          { ref: koi1Ref, col: "#ff6b52" },
          { ref: koi2Ref, col: "#ffa84c" },
        ].map((fish, idx) => (
          <group key={idx} ref={fish.ref}>
            <mesh scale={[0.55, 0.45, 1.4]}>
              <sphereGeometry args={[0.010, 8, 8]} />
              <CuteMat color={fish.col} boost={0.46} />
            </mesh>
            <mesh position={[0, 0.002, 0.004]} scale={[0.45, 0.35, 0.6]}>
              <sphereGeometry args={[0.008, 6, 6]} />
              <CuteMat color="#ffffff" boost={0.52} />
            </mesh>
            <mesh position={[0, 0, -0.015]} rotation={[0, 0, 0]} scale={[0.25, 0.65, 0.85]}>
              <coneGeometry args={[0.008, 0.014, 5]} />
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
        {/* Chestnut squirrel body + cream belly */}
        <mesh position={[0, 0.020, 0]} scale={[0.88, 1.12, 0.95]}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <CuteMat color="#c77542" boost={0.34} />
        </mesh>
        <mesh position={[0, 0.018, 0.008]} scale={[0.65, 0.85, 0.6]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <CuteMat color="#faebd2" boost={0.40} />
        </mesh>
        {/* Head + pointy ears + eyes */}
        <mesh position={[0, 0.042, 0.008]}>
          <sphereGeometry args={[0.014, 10, 10]} />
          <CuteMat color="#c77542" boost={0.34} />
        </mesh>
        {[-0.009, 0.009].map((ex, i) => (
          <mesh key={i} position={[ex, 0.055, 0.005]}>
            <coneGeometry args={[0.005, 0.011, 6]} />
            <CuteMat color="#b56435" boost={0.32} />
          </mesh>
        ))}
        <mesh position={[-0.006, 0.044, 0.020]}>
          <sphereGeometry args={[0.0022, 6, 6]} />
          <meshBasicMaterial color="#2f2328" />
        </mesh>
        <mesh position={[0.006, 0.044, 0.020]}>
          <sphereGeometry args={[0.0022, 6, 6]} />
          <meshBasicMaterial color="#2f2328" />
        </mesh>
        {/* Tiny acorn held in paws */}
        <mesh position={[0, 0.024, 0.021]} scale={[0.85, 1.1, 0.85]}>
          <sphereGeometry args={[0.007, 7, 7]} />
          <CuteMat color="#8c5432" boost={0.30} />
        </mesh>
        {/* Big fluffy curled tail */}
        <group ref={sqTailRef} position={[0, 0.022, -0.018]}>
          <mesh position={[0, 0.018, -0.010]} scale={[0.75, 1.35, 0.85]}>
            <sphereGeometry args={[0.016, 10, 10]} />
            <CuteMat color="#d9874e" boost={0.36} />
          </mesh>
          <mesh position={[0, 0.038, -0.004]} scale={[0.7, 0.85, 0.7]}>
            <sphereGeometry args={[0.013, 8, 8]} />
            <CuteMat color="#f5dec0" boost={0.42} />
          </mesh>
        </group>
      </group>
    );
  }

  // WINTER: Cozy curled-up ginger-white kitty warming beside the campfire!
  const y0 = getTerrainY("winter", -0.26, 0.10);
  return (
    <group ref={kittyRef} position={[-0.26, y0, 0.10]} rotation={[0, -0.9, 0]} onClick={triggerHop}>
      {/* Curled cozy ginger body */}
      <mesh position={[0, 0.015, 0]} scale={[1.25, 0.72, 1.05]}>
        <sphereGeometry args={[0.022, 12, 10]} />
        <CuteMat color="#f5a55c" boost={0.32} />
      </mesh>
      {/* Round kitty head + white muzzle */}
      <mesh position={[0.015, 0.028, 0.012]}>
        <sphereGeometry args={[0.015, 10, 10]} />
        <CuteMat color="#f7b06b" boost={0.34} />
      </mesh>
      <mesh position={[0.017, 0.024, 0.022]} scale={[1, 0.75, 0.7]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <CuteMat color="#fff6eb" boost={0.38} />
      </mesh>
      {/* Pointy kitty ears */}
      <mesh position={[0.007, 0.042, 0.010]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.0055, 0.012, 5]} />
        <CuteMat color="#f0984c" boost={0.32} />
      </mesh>
      <mesh position={[0.023, 0.042, 0.010]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.0055, 0.012, 5]} />
        <CuteMat color="#f0984c" boost={0.32} />
      </mesh>
      {/* Happy closed sleeping eyes */}
      <mesh position={[0.010, 0.030, 0.025]}>
        <boxGeometry args={[0.005, 0.0018, 0.002]} />
        <meshBasicMaterial color="#3c2b36" />
      </mesh>
      <mesh position={[0.020, 0.030, 0.025]}>
        <boxGeometry args={[0.005, 0.0018, 0.002]} />
        <meshBasicMaterial color="#3c2b36" />
      </mesh>
      {/* Swaying curled tail */}
      <mesh ref={kittyTailRef} position={[-0.022, 0.014, 0.012]} rotation={[0, 0, Math.PI / 2 - 0.35]} scale={[0.55, 1.5, 0.55]}>
        <sphereGeometry args={[0.011, 8, 8]} />
        <CuteMat color="#fff3e2" boost={0.36} />
      </mesh>
      {/* Floating happy pink heart on click */}
      <mesh ref={heartRef} position={[0.015, 0.068, 0.012]} visible={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ff7ca3" />
      </mesh>
    </group>
  );
}
