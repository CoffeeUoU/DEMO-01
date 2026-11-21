"use client";

import { useEffect, useRef, useState } from "react";
import { addEntry, deleteEntry, listEntries, type Entry } from "@/lib/journal";
import type { Spot } from "@/lib/spots";

function when(ms: number) {
  const d = new Date(ms);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toLowerCase().replace(",", "");
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `${day} · ${time}`;
}

/** The paper sheet that opens when you click a room's journal spot. */
export default function JournalPanel({ room, spotKey, spot, onClose }: { room: string; spotKey: string; spot: Spot; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [tearing, setTearing] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listEntries(room, spotKey).then(setEntries);
    const t = setTimeout(() => area.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [room, spotKey]);

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

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      setError("write something first");
      area.current?.focus();
      return;
    }
    const e = await addEntry(room, spotKey, text);
    setEntries((list) => [e, ...list]);
    setDraft("");
  };

  const tear = async (id: string) => {
    await deleteEntry(id);
    setEntries((list) => list.filter((e) => e.id !== id));
    setTearing(null);
  };

  return (
    <div className={`journal-backdrop ${leaving ? "leaving" : ""}`} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className="journal-sheet" role="dialog" aria-label={spot.title}>
        <header className="journal-head">
          <div>
            <div className="journal-room">{room}</div>
            <h2 className="journal-title">{spot.title}</h2>
          </div>
          <button className="journal-x" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
              <path d="M10 10 C 18 17, 24 24, 31 30" />
              <path d="M30 9 C 23 17, 17 23, 9 31" />
            </svg>
          </button>
        </header>

        <div className="journal-compose">
          <textarea
            ref={area}
            value={draft}
            rows={4}
            placeholder={spot.prompt}
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
          <div className="journal-actions">
            {error && <span className="journal-error">{error}</span>}
            <button className="hand-btn" onClick={save}>
              {spot.save}
            </button>
          </div>
        </div>

        <div className="journal-list">
          {entries.length === 0 && <p className="journal-empty">{spot.empty}</p>}
          {entries.map((e, i) => (
            <article key={e.id} className="journal-entry" style={{ rotate: `${((i * 37) % 5) * 0.35 - 0.7}deg` }}>
              <div className="journal-when">
                {when(e.createdAt)}
                {tearing === e.id ? (
                  <span className="journal-confirm">
                    tear it out?{" "}
                    <button onClick={() => tear(e.id)}>yes</button> <button onClick={() => setTearing(null)}>keep</button>
                  </span>
                ) : (
                  <button className="journal-tear" onClick={() => setTearing(e.id)}>
                    tear out
                  </button>
                )}
              </div>
              <p className="journal-text">{e.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
