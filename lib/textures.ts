import type * as THREE from "three";
import { bake } from "./sketch";
import { ROOMS, drawBackCover, drawFrontCover } from "./rooms";

type RoomTextures = { left: THREE.Texture; right: THREE.Texture; floor: THREE.Texture; popups: THREE.Texture[] };
export type BookTextures = { rooms: RoomTextures[]; front: THREE.Texture; back: THREE.Texture };

/** Draws every surface of the book. Indexed by logical room (0 = bedroom). */
export function buildTextures(font: string): BookTextures {
  const isSmall = typeof window !== "undefined" && window.innerWidth <= 768;
  const wallRes = isSmall ? 512 : 768;
  const popRes = isSmall ? 256 : 512;
  const popCutRes = isSmall ? 512 : 768;
  const rooms = ROOMS.map((room, i) => ({
    left: bake(wallRes, 100 + i * 10, font, true, room.left),
    right: bake(wallRes, 101 + i * 10, font, true, room.right),
    floor: bake(wallRes, 102 + i * 10, font, true, room.floor),
    popups: room.popups.map((p, j) => bake(p.halo ? popCutRes : popRes, 200 + i * 10 + j, font, false, p.draw, p.halo ?? 0)),
  }));
  return {
    rooms,
    front: bake(wallRes, 7, font, true, drawFrontCover),
    back: bake(wallRes, 8, font, true, drawBackCover),
  };
}
