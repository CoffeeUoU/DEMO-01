// The place in each season where you write, and how that journal talks to you.

export type Kind = "cork" | "mirror" | "fridge" | "diary";
export type Spot = { title: string; kind: Kind; prompt: string; save: string; empty: string };

export const SPOTS: Record<string, Record<string, Spot>> = {
  spring: {
    journal: {
      title: "spring notes",
      kind: "cork",
      prompt: "what is beginning to bloom in your life…",
      save: "pin it",
      empty: "petals are falling. leave a spring thought.",
    },
  },
  summer: {
    journal: {
      title: "summer shade",
      kind: "fridge",
      prompt: "a bright moment worth keeping…",
      save: "keep it",
      empty: "quiet under the canopy. write a summer memory.",
    },
  },
  autumn: {
    journal: {
      title: "autumn leaves",
      kind: "mirror",
      prompt: "what are you ready to let go of…",
      save: "tuck it in",
      empty: "golden leaves drift past. leave a note for autumn.",
    },
  },
  winter: {
    journal: {
      title: "winter lantern",
      kind: "diary",
      prompt: "in the quiet snow, i am grateful for…",
      save: "write it down",
      empty: "a fresh snowy page. the night is still.",
    },
  },
};
