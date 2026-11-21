// The place in each room where you write, and how that journal talks to you.

export type Spot = { title: string; prompt: string; save: string; empty: string };

export const SPOTS: Record<string, Record<string, Spot>> = {
  bedroom: {
    journal: {
      title: "the cork board",
      prompt: "pin a thought before sleep…",
      save: "pin it",
      empty: "nothing pinned yet. the board is waiting.",
    },
  },
  bathroom: {
    journal: {
      title: "the mirror",
      prompt: "what did you tell yourself today?",
      save: "stick it on",
      empty: "the mirror is clear. say something kind.",
    },
  },
  kitchen: {
    journal: {
      title: "the fridge door",
      prompt: "what fed you today?",
      save: "stick it on",
      empty: "an empty fridge door. leave a note.",
    },
  },
  balcony: {
    journal: {
      title: "the diary",
      prompt: "tonight, i'm thinking about…",
      save: "write it down",
      empty: "a fresh page. the night is quiet.",
    },
  },
};
