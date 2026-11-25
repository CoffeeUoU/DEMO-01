"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import Book from "./Book";
import Closeup from "./Closeup";
import { SPOTS } from "@/lib/spots";
import { HandArrow, HandUnderline } from "./Hand";
import { N, logicalOf, physicalOf } from "@/lib/fold";
import { ROOMS } from "@/lib/rooms";
import { book } from "@/lib/store";
import { buildTextures, type BookTextures } from "@/lib/textures";

const FONT = "Caveat";

export default function Experience() {
  const [tex, setTex] = useState<BookTextures | null>(null);
  const [room, setRoom] = useState(0); // logical index
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState<{ room: string; spot: string } | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const drag = useRef({ x: 0, startX: 0, active: false });
  const roomRef = useRef(0);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Cozy optional Web Audio healing breeze + music-box pentatonic chimes
  const audioRef = useRef<{ ctx: AudioContext; timer: number; gain: GainNode } | null>(null);
  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    window.clearInterval(a.timer);
    try {
      a.gain.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + 0.3);
      setTimeout(() => a.ctx.close().catch(() => {}), 350);
    } catch {
      a.ctx.close().catch(() => {});
    }
    audioRef.current = null;
  }, []);

  const toggleSound = useCallback(() => {
    if (audioRef.current) {
      stopAudio();
      setSoundOn(false);
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.13;
    master.connect(ctx.destination);

    // Soft filtered breeze
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 0.7;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const bg = ctx.createGain();
    bg.gain.value = 0.18;
    noise.connect(lp);
    lp.connect(bg);
    bg.connect(master);
    noise.start();

    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const chime = () => {
      if (ctx.state !== "running") return;
      const mult = roomRef.current === 3 ? 0.5 : roomRef.current === 2 ? 0.75 : 1.0;
      const freq = notes[Math.floor(Math.random() * notes.length)] * mult;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.4);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 2.5);
    };
    chime();
    const timer = window.setInterval(() => {
      if (Math.random() < 0.7) chime();
    }, 2300);
    audioRef.current = { ctx, timer, gain: master };
    setSoundOn(true);
  }, [stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // Draw every surface once the handwriting font is ready.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await Promise.all([document.fonts.load(`700 64px ${FONT}`), document.fonts.load(`500 64px ${FONT}`)]);
      } catch {
        /* fall back to whatever cursive font is around */
      }
      if (alive) setTex(buildTextures(`${FONT}, cursive`));
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      if (writing) return; // the journal sheet handles its own keys
      if (ev.key === "ArrowRight") {
        if (!open) setBookOpen(true);
        else goTo(room + 1);
      } else if (ev.key === "ArrowLeft") {
        if (open) {
          if (room === 0) setBookOpen(false);
          else goTo(room - 1);
        }
      } else if (ev.key === "Enter" || ev.key === " ") {
        setBookOpen(!open);
      } else if (ev.key === "Escape") setBookOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, room, goTo, setBookOpen, writing]);

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
  const stageSeason = open ? current.name : "cover";

  return (
    <main className="stage" data-season={stageSeason}>
      <header className="topbar">
        <div className="wordmark">
          unfold
          <HandUnderline />
        </div>
        <button
          type="button"
          className={`cute-sound-btn ${soundOn ? "is-on" : ""}`}
          onClick={toggleSound}
          title="开启 / 关闭治愈微风与风铃声"
        >
          <span>{soundOn ? "♪ 治愈音开" : "♪ 治愈音"}</span>
        </button>
      </header>

      <div className="canvas-wrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => setBookOpen(!open)}>
        {tex && (
          <Canvas orthographic flat linear dpr={[1, 2]} camera={{ position: [0, 2, 10], zoom: 200, near: 0.1, far: 100 }} gl={{ alpha: true, antialias: true }}>
            <Book
              tex={tex}
              onSpot={(li, spot) => {
                // move in on the spot, then open its close-up
                book.zoomTarget = 1;
                setTimeout(() => setWriting({ room: ROOMS[li].name, spot }), 380);
              }}
            />
            <ContactShadows position={[0, -0.04, 0]} scale={5} resolution={512} far={1.4} blur={2.4} opacity={0.32} color="#2a2350" frames={Infinity} />
          </Canvas>
        )}
        {!tex && <div className="loading">sharpening pencils…</div>}
      </div>

      <button
        className={`arrow arrow-left ${open ? "" : "is-off"} ${writing ? "is-hidden" : ""}`}
        aria-label={room === 0 ? "Close the book" : "Previous room"}
        onClick={() => (room === 0 ? setBookOpen(false) : goTo(room - 1))}
        disabled={!open}
      >
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
      {writing && SPOTS[writing.room]?.[writing.spot] && (
        <Closeup
          room={writing.room}
          spotKey={writing.spot}
          spot={SPOTS[writing.room][writing.spot]}
          onClose={() => {
            setWriting(null);
            book.zoomTarget = 0;
          }}
        />
      )}
    </main>
  );
}
