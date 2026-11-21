# unfold

A journal house: a hand-drawn pop-up book whose rooms fold open one at a time.

- **Half-fan book** — pages radiate from the spine. The room in front opens to a right angle,
  its creased floor drops flat, and its pop-up furniture stands up. The rest of the book folds
  into stacks on either side.
- **Hybrid style** — everything is blue-ink line art on paper; the room in front washes with colour.
- **Six rooms** — bedroom, bathroom, kitchen, gym, lounge, balcony. See [ROOMS.md](./ROOMS.md).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Arrow keys or the side arrows page through rooms, drag sideways to
flip, Enter / double-click opens and closes the book.

## How it's built

| File | What it does |
|------|--------------|
| `lib/fold.ts` | Fold geometry: page angles for a focus position, the floor's crease apex, camera focus. |
| `lib/sketch.ts` | Tiny hand-drawn 2D renderer (wobbly ink lines, watercolour fills, hatching) and `bake()`, which packs ink + wash + cut-out mask into one texture. |
| `lib/rooms.ts` | The drawings for every wall, floor and pop-up, plus the covers. |
| `lib/paperMaterial.ts` | Shader: paper grain, watercolour reveal, soft light, pen hatching on shadowed faces. |
| `components/Book.tsx` | The R3F scene: pages, folding floors, pop-ups, camera. |
| `components/Experience.tsx` | Canvas, controls, drag + keyboard input, captions. |

Stack: Next.js (App Router), React Three Fiber, drei, three.js. Handwriting is Caveat via `@fontsource/caveat`.

### The floor fold

Each floor is a square creased on its diagonal. With walls at angle θ apart, the crease apex sits at
distance `L / cos(θ/2)` along the bisector and height `sqrt(2L² − (L / cos(θ/2))²)`: flat at 90°,
standing straight up when the book is shut.
