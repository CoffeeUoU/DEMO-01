"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = { rect: DOMRect; text: string; onDone: () => void };

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Tearing out a page: a copy of the sheet scrunches up (its outline pulls in to a lumpy blob,
 * creases appear, it shrinks and twists), turns into a hand-drawn paper ball, bounces once and
 * rolls away.
 */
export default function Crumple({ rect, text, onDone }: Props) {
  const ghost = useRef<HTMLDivElement>(null);
  const creases = useRef<SVGSVGElement>(null);
  const edge = useRef<SVGPolygonElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"crumple" | "ball">("crumple");

  // outline of the sheet, walked round its edge, and the lumpy blob each point pulls in to
  const shape = useMemo(() => {
    const n = 36;
    const from: [number, number][] = [];
    const to: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 4;
      const side = Math.floor(t);
      const f = t - side;
      const p: [number, number] = side === 0 ? [f * 100, 0] : side === 1 ? [100, f * 100] : side === 2 ? [100 - f * 100, 100] : [0, 100 - f * 100];
      from.push(p);
      const a = Math.atan2(p[1] - 50, p[0] - 50);
      const r = 26 + Math.random() * 14 * (i % 2 ? 1 : 0.55);
      to.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
    const lines = Array.from({ length: 16 }, () => {
      const x = 20 + Math.random() * 60;
      const y = 20 + Math.random() * 60;
      const pts = [[x, y]];
      for (let k = 0; k < 3; k++) pts.push([pts[k][0] + (Math.random() - 0.5) * 30, pts[k][1] + (Math.random() - 0.5) * 30]);
      return pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
    });
    return { from, to, lines };
  }, []);

  // a hand-drawn paper ball
  const ballShape = useMemo(() => {
    const pts: string[] = [];
    const n = 15;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 40 * (0.82 + Math.random() * 0.22);
      pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
    }
    const folds = Array.from({ length: 9 }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 26;
      const x = 50 + Math.cos(a) * r;
      const y = 50 + Math.sin(a) * r;
      const b = a + (Math.random() - 0.5) * 2.4;
      const len = 8 + Math.random() * 14;
      return `M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.cos(b) * len).toFixed(1)} ${(Math.sin(b) * len).toFixed(1)} l${((Math.random() - 0.5) * 10).toFixed(1)} ${((Math.random() - 0.5) * 10).toFixed(1)}`;
    });
    return { outline: pts.join(" "), folds };
  }, []);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const CRUMPLE = 520;
    const BALL = 1050;
    const tick = (now: number) => {
      const ms = now - start;
      if (ms < CRUMPLE) {
        const t = ease(ms / CRUMPLE);
        const poly = shape.from.map(([x, y], i) => {
          const [tx, ty] = shape.to[i];
          // corners lag a little so it scrunches unevenly
          const k = clamp01(t * (1.05 + (i % 3) * 0.12) - (i % 4) * 0.03);
          return `${(x + (tx - x) * k).toFixed(2)}% ${(y + (ty - y) * k).toFixed(2)}%`;
        });
        if (edge.current) edge.current.setAttribute("points", poly.map((q) => q.replace(/%/g, "")).join(" "));
        if (ghost.current) {
          ghost.current.style.clipPath = `polygon(${poly.join(",")})`;
          ghost.current.style.transform = `scale(${1 - 0.5 * t}) rotate(${-14 * t}deg)`;
        }
        if (creases.current) creases.current.style.opacity = String(Math.min(1, t * 1.6));
      } else if (ms < CRUMPLE + BALL) {
        if (phase !== "ball") setPhase("ball");
        const t = (ms - CRUMPLE) / BALL;
        // drop, one bounce, then roll off to the left while fading
        const drop = t < 0.35 ? ease(t / 0.35) : 1;
        const bounce = t >= 0.35 && t < 0.6 ? Math.sin(((t - 0.35) / 0.25) * Math.PI) * 0.35 : 0;
        const roll = t > 0.5 ? ease((t - 0.5) / 0.5) : 0;
        const y = (drop - bounce) * rect.height * 0.34;
        const x = -roll * Math.min(380, rect.left + rect.width / 2 + 80);
        const size = 1 - 0.45 * clamp01(t / 0.35);
        if (ball.current) {
          ball.current.style.transform = `translate(${x}px, ${y}px) rotate(${-30 - roll * 540}deg) scale(${size})`;
          ball.current.style.opacity = String(1 - clamp01((t - 0.72) / 0.28));
        }
      } else {
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ballSize = Math.min(rect.width, rect.height) * 0.36;

  return (
    <div className="crumple" aria-hidden="true">
      {phase === "crumple" && (
        <div ref={ghost} className="crumple-ghost" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
          <div className="crumple-text">{text}</div>
          <svg ref={creases} className="crumple-creases" viewBox="0 0 100 100" preserveAspectRatio="none">
            {shape.lines.map((l, i) => (
              <polyline key={i} points={l} />
            ))}
          </svg>
          <svg className="crumple-edge" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon ref={edge} points="0,0 100,0 100,100 0,100" />
          </svg>
        </div>
      )}
      {phase === "ball" && (
        <div
          ref={ball}
          className="crumple-ball"
          style={{ left: rect.left + rect.width / 2 - ballSize / 2, top: rect.top + rect.height / 2 - ballSize / 2, width: ballSize, height: ballSize }}
        >
          <svg viewBox="0 0 100 100">
            <defs>
              <radialGradient id="ballshade" cx="38%" cy="34%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#f1efe9" />
                <stop offset="100%" stopColor="#dcd8ea" />
              </radialGradient>
            </defs>
            <polygon points={ballShape.outline} fill="url(#ballshade)" />
            {ballShape.folds.map((d, i) => (
              <path key={i} d={d} className="fold" />
            ))}
            <polygon points={ballShape.outline} className="edge" />
          </svg>
        </div>
      )}
    </div>
  );
}
