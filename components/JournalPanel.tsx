"use client";

import { useEffect, useRef, useState } from "react";
import { addEntry, deleteEntry, listEntries, updateEntry, type Entry } from "@/lib/journal";
import type { Spot } from "@/lib/spots";
import Crumple from "./Crumple";

const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toLowerCase().replace(",", "");
const time = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

/**
 * The journal for one spot: its name as a heading, past notes down the left (a blank page with a
 * + on top), and a tall lined page to write on or to re-read and edit a note.
 */
export default function JournalPanel({ room, spotKey, spot, onClose }: { room: string; spotKey: string; spot: Spot; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<string | null>(null); // null = a new, blank page
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [crumple, setCrumple] = useState<{ rect: DOMRect; text: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const paper = useRef<HTMLElement>(null);

  useEffect(() => {
    listEntries(room, spotKey).then(setEntries);
  }, [room, spotKey]);

  const focusSoon = () => setTimeout(() => area.current?.focus(), 60);
  useEffect(() => {
    const t = setTimeout(() => area.current?.focus(), 280);
    return () => clearTimeout(t);
  }, []);

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
    setCurrent(e?.id ?? null);
    setDraft(e?.text ?? "");
    setError("");
    setSaved(false);
    focusSoon();
  };

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      setError("write something first");
      area.current?.focus();
      return;
    }
    if (current) {
      await updateEntry(current, text);
      setEntries((list) => list.map((e) => (e.id === current ? { ...e, text } : e)));
      setSaved(true);
    } else {
      const e = await addEntry(room, spotKey, text);
      setEntries((list) => [e, ...list]);
      setDraft("");
      focusSoon();
    }
  };

  // tear the page out: it crumples into a ball and rolls away, and a fresh page takes its place
  const tear = async () => {
    if (!current || !paper.current) return;
    setCrumple({ rect: paper.current.getBoundingClientRect(), text: draft });
    await deleteEntry(current);
    setEntries((list) => list.filter((e) => e.id !== current));
    open(null);
  };

  const editing = entries.find((e) => e.id === current);

  return (
    <div className={`journal ${leaving ? "leaving" : ""}`}>
      <header className="journal-head">
        <h2 className="journal-title">{spot.title}</h2>
        <button className="journal-x" aria-label="Close" onClick={close}>
          <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
            <path d="M10 10 C 18 17, 24 24, 31 30" />
            <path d="M30 9 C 23 17, 17 23, 9 31" />
          </svg>
        </button>
      </header>

      <div className="journal-body">
        <nav className="journal-notes" aria-label="Past notes">
          <button className={`journal-note journal-new ${current === null ? "on" : ""}`} onClick={() => open(null)} aria-label="New page">
            <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
              <path d="M20 8 C 20.5 16, 19.5 24, 20 32" />
              <path d="M8 20.5 C 16 19.5, 24 20.5, 32 20" />
            </svg>
          </button>
          {entries.map((e, i) => (
            <button
              key={e.id}
              className={`journal-note ${current === e.id ? "on" : ""}`}
              style={{ rotate: `${((i * 37) % 5) * 0.6 - 1.2}deg` }}
              onClick={() => open(e)}
            >
              <span className="journal-note-day">{day(e.createdAt)}</span>
              <span className="journal-note-time">{time(e.createdAt)}</span>
              <span className="journal-note-text">{e.text}</span>
            </button>
          ))}
        </nav>

        <section ref={paper} className={`journal-paper ${crumple ? "refilling" : ""}`}>
          <div className="journal-paper-when">{editing ? `${day(editing.createdAt)} · ${time(editing.createdAt)}` : "\u00a0"}</div>
          <textarea
            ref={area}
            value={draft}
            placeholder={spot.prompt}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError("");
              if (saved) setSaved(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              }
            }}
          />
          <div className="journal-actions">
            {current && (
              <button className="journal-tear" onClick={tear}>
                tear out
              </button>
            )}
            <span className="journal-spacer" />
            {error && <span className="journal-error">{error}</span>}
            {saved && !error && <span className="journal-saved">saved</span>}
            <button className="hand-btn" onClick={save}>
              {current ? "save changes" : spot.save}
            </button>
          </div>
        </section>
      </div>
      {crumple && <Crumple rect={crumple.rect} text={crumple.text} onDone={() => setCrumple(null)} />}
    </div>
  );
}
