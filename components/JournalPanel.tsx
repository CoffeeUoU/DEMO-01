"use client";

import { useEffect, useRef, useState } from "react";
import { addEntry, deleteEntry, listEntries, updateEntry, type Entry } from "@/lib/journal";
import type { Spot } from "@/lib/spots";

const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toLowerCase().replace(",", "");
const time = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

/**
 * A room's journal: the heading up top, past notes pinned down the left, and one big sheet of
 * lined paper to write on (or to re-read and edit an older note).
 */
export default function JournalPanel({ room, spotKey, spot, onClose }: { room: string; spotKey: string; spot: Spot; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // null = a fresh page
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [tearing, setTearing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [flip, setFlip] = useState(0); // re-triggers the page animation
  const area = useRef<HTMLTextAreaElement>(null);

  const current = entries.find((e) => e.id === selected) ?? null;
  const dirty = current ? draft.trim() !== current.text : draft.trim().length > 0;

  useEffect(() => {
    listEntries(room, spotKey).then(setEntries);
  }, [room, spotKey]);

  useEffect(() => {
    const t = setTimeout(() => area.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [flip]);

  const close = () => {
    setLeaving(true);
    setTimeout(onClose, 220);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (e: Entry | null) => {
    setSelected(e?.id ?? null);
    setDraft(e?.text ?? "");
    setError("");
    setTearing(false);
    setFlip((n) => n + 1);
  };

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      setError("write something first");
      area.current?.focus();
      return;
    }
    if (current) {
      await updateEntry(current.id, text);
      setEntries((list) => list.map((e) => (e.id === current.id ? { ...e, text } : e)));
    } else {
      const e = await addEntry(room, spotKey, text);
      setEntries((list) => [e, ...list]);
      setSelected(e.id);
      setDraft(text);
    }
  };

  const tear = async () => {
    if (!current) return;
    await deleteEntry(current.id);
    setEntries((list) => list.filter((e) => e.id !== current.id));
    open(null);
  };

  return (
    <div className={`jr-backdrop ${leaving ? "leaving" : ""}`} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className="jr-frame" role="dialog" aria-label={spot.title}>
        <header className="jr-head">
          <h2 className="jr-title">{spot.title}</h2>
          <span className="jr-room">{room === "balcony" ? "on" : "in"} the {room}</span>
        </header>

        <div className="jr-body">
          <nav className="jr-rail" aria-label="Your notes">
            <button className={`jr-note jr-new ${selected === null ? "on" : ""}`} onClick={() => open(null)} aria-label="New note">
              <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
                <path d="M20 8 C 19.5 16, 20.5 24, 20 32" />
                <path d="M8 20.5 C 16 19.5, 24 20.5, 32 19.8" />
              </svg>
            </button>
            {entries.map((e, i) => (
              <button
                key={e.id}
                className={`jr-note ${selected === e.id ? "on" : ""}`}
                style={{ rotate: `${[-2.5, 1.8, -1, 2.6, -1.8, 1][i % 6]}deg` }}
                onClick={() => open(e)}
              >
                <span className="jr-note-day">{day(e.createdAt)}</span>
                <span className="jr-note-time">{time(e.createdAt)}</span>
                <span className="jr-note-text">{e.text}</span>
              </button>
            ))}
          </nav>

          <article key={flip} className="jr-paper">
            <button className="jr-x" aria-label="Close" onClick={close}>
              <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
                <path d="M10 10 C 18 17, 24 24, 31 30" />
                <path d="M30 9 C 23 17, 17 23, 9 31" />
              </svg>
            </button>
            <div className="jr-paper-when">{current ? `${day(current.createdAt)} · ${time(current.createdAt)}` : "today"}</div>
            <textarea
              ref={area}
              value={draft}
              placeholder={entries.length || current ? spot.prompt : `${spot.empty}\n\n${spot.prompt}`}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                }
              }}
            />
            <footer className="jr-paper-foot">
              {current &&
                (tearing ? (
                  <span className="jr-confirm">
                    tear it out? <button onClick={tear}>yes</button> <button onClick={() => setTearing(false)}>keep</button>
                  </span>
                ) : (
                  <button className="jr-link" onClick={() => setTearing(true)}>
                    tear out
                  </button>
                ))}
              <span className="jr-spacer" />
              {error && <span className="jr-error">{error}</span>}
              {(dirty || !current) && (
                <button className="hand-btn" onClick={save}>
                  {current ? "save changes" : spot.save}
                </button>
              )}
            </footer>
          </article>
        </div>
      </section>
    </div>
  );
}
