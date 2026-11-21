import { N } from "./fold";

/**
 * Animation state shared between the DOM controls and the 3D scene.
 * Kept outside React so dragging doesn't re-render every frame.
 * f / target are physical slots (N-1 = the room right behind the front cover).
 */
export const book = {
  f: N - 1,
  target: N - 1,
  open: 0,
  openTarget: 0,
  dragging: false,
};
