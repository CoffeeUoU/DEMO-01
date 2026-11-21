"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import Book from "./Book";
import { HandArrow, HandUnderline } from "./Hand";
import { N, logicalOf, physicalOf } from "@/lib/fold";
import { ROOMS } from "@/lib/rooms";
import { book } from "@/lib/store";
import { buildTextures, type BookTextures } from "@/lib/textures";
import { look, type Pen } from "@/lib/style";

const FONT = "Caveat";

export default function Experience() {
  const [tex, setTex] = useState<BookTextures | null>(null);
  const [room, setRoom] = useState(0); // logical index
  const [open, setOpen] = useState(false);
  const drag = useRef({ x: 0, startX: 0, active: false });

  // Drawing style: loose or neat pen, ink-only or softly coloured. Remembered per browser;
  // ?pen=clean / ?color=1 in the URL also work.
  const [pen, setPen] = useState<Pen>("sketchy");
  const [color, setColor] = useState(false);
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let p: Pen = "sketchy";
    let c = false;
    try {
      p = (localStorage.getItem("unfold.pen") as Pen) || p;
      c = localStorage.getItem("unfold.color") === "1";
    } catch {
      /* storage can be unavailable */
    }
    if (q.get("pen") === "clean" || q.get("pen") === "sketchy") p = q.get("pen") as Pen;
    if (q.has("color")) c = q.get("color") !== "0";
    setPen(p);
    setColor(c);
    let alive = true;
    (async () => {
      try {
        await Promise.all([document.fonts.load(`700 64px ${FONT}`), document.fonts.load(`500 64px ${FONT}`)]);
      } catch {
        /* fall back to whatever cursive font is around */
      }
      if (alive) setFontReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // (Re)draw every surface whenever the style changes.
  useEffect(() => {
    if (!fontReady) return;
    look.pen = pen;
    look.color = color;
    try {
      localStorage.setItem("unfold.pen", pen);
      localStorage.setItem("unfold.color", color ? "1" : "0");
    } catch {
      /* ignore */
    }
    const next = buildTextures(`${FONT}, cursive`);
    setTex((prev) => {
      if (prev) {
        for (const r of prev.rooms) [r.left, r.right, r.floor, ...r.popups].forEach((x) => x.dispose());
        prev.front.dispose();
        prev.back.dispose();
      }
      return next;
    });
  }, [fontReady, pen, color]);

  const goTo = useCallback((logical: number) => {
    const li = Math.max(0, Math.min(N - 1, logical));
    book.target = physicalOf(li);
    setRoom(li);
  }, []);

  const setBookOpen = useCallback((v: boolean) => {
    book.openTarget = v ? 1 : 0;
    setOpen(v);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowRight") {
        if (!open) setBookOpen(true);
        else goTo(room + 1);
      } else if (ev.key === "ArrowLeft") {
        if (open) goTo(room - 1);
      } else if (ev.key === "Enter" || ev.key === " ") {
        setBookOpen(!open);
      } else if (ev.key === "Escape") setBookOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, room, goTo, setBookOpen]);

  // Drag sideways to page through: content follows your finger.
  const onDown = (ev: React.PointerEvent) => {
    drag.current = { x: ev.clientX, startX: ev.clientX, active: true };
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    if (open) book.dragging = true;
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!drag.current.active || !open) return;
    const dx = ev.clientX - drag.current.x;
    drag.current.x = ev.clientX;
    book.f = Math.max(0, Math.min(N - 1, book.f + dx / 170));
  };
  const onUp = (ev: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const moved = Math.abs(ev.clientX - drag.current.startX);
    if (!open) {
      if (moved < 6) setBookOpen(true);
      return;
    }
    book.dragging = false;
    goTo(logicalOf(Math.round(book.f)));
  };

  const current = ROOMS[room];

  return (
    <main className="stage">
      <header className="topbar">
        <div className="wordmark">
          unfold
          <HandUnderline />
        </div>
        <div className="topright">
          <div className="style-toggles" aria-label="Drawing style">
            <button className={`chip ${pen === "sketchy" ? "on" : ""}`} onClick={() => setPen(pen === "sketchy" ? "clean" : "sketchy")}>
              {pen === "sketchy" ? "loose pen" : "neat pen"}
            </button>
            <button className={`chip ${color ? "on" : ""}`} onClick={() => setColor(!color)}>
              {color ? "a little colour" : "ink only"}
            </button>
          </div>
          <span className="counter">{open ? `room ${room + 1} of ${N}` : "closed"}</span>
          <button className="hand-btn" onClick={() => setBookOpen(!open)}>
            {open ? "close the book" : "open the book"}
          </button>
        </div>
      </header>

      <div className="canvas-wrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => setBookOpen(!open)}>
        {tex && (
          <Canvas orthographic flat linear dpr={[1, 2]} camera={{ position: [0, 2, 10], zoom: 200, near: 0.1, far: 100 }} gl={{ alpha: true, antialias: true }}>
            <Book tex={tex} />
            <ContactShadows position={[0, -0.04, 0]} scale={5} resolution={512} far={1.4} blur={2.4} opacity={0.32} color="#2a2350" frames={Infinity} />
          </Canvas>
        )}
        {!tex && <div className="loading">sharpening pencils…</div>}
      </div>

      <button className={`arrow arrow-left ${open && room > 0 ? "" : "is-off"}`} aria-label="Previous room" onClick={() => goTo(room - 1)} disabled={!open || room === 0}>
        <HandArrow flip />
      </button>
      <button
        className={`arrow arrow-right ${!open || room < N - 1 ? "" : "is-off"}`}
        aria-label={open ? "Next room" : "Open the book"}
        onClick={() => (open ? goTo(room + 1) : setBookOpen(true))}
        disabled={open && room === N - 1}
      >
        <HandArrow />
      </button>

      <footer className="caption">
        {open ? (
          <>
            <div className="room-name">{current.name}</div>
            <div className="room-mood">{current.mood}</div>
          </>
        ) : (
          <div className="room-mood">tap the cover to open</div>
        )}
      </footer>
    </main>
  );
}
