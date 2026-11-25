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
  /** 0..1, how far the camera has moved in on a journal spot */
  zoom: 0,
  zoomTarget: 0,
  /** world position of the spot being zoomed into */
  zoomAt: [0, 0.5, 0] as [number, number, number],
  /** 0..1, close-up miniature roam camera mode */
  roam: 0,
  roamTarget: 0,
  /** toggleable micro-weather per season (rain / autumn gust / heavy snowfall) */
  weatherAlt: false,
  /** Final user-tuned 3D wall mountain parameters (高低 / 宽窄 / 长短) */
  mountain: {
    height: 0.48,
    width: 1.74,
    length: 1.4,
  },
};
