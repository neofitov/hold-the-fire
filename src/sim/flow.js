// The way to the fire for every tile (Dijkstra from the fire). A standing wall is passable at a cost that grows with its health,
// so the horde walks around the palisade through the open corners and breaks through only where that is shorter.
import { BAL } from './config.js';
import { wallAt } from './world.js';

export const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function buildFlow(world) {
  const { w, h } = BAL.map;
  const dist = new Float32Array(w * h).fill(Infinity);
  const cost = new Float32Array(w * h).fill(1);
  for (const p of world.pads) if (p.kind === 'wall' && p.level > 0) for (const [x, y] of p.tiles) cost[y * w + x] = p.broken ? BAL.wall.rubbleCost : 1 + p.hp / 6;
  for (const [x, y] of world.solid || []) cost[y * w + x] = Infinity;   // the booth and the crate: round them
  const fx = Math.floor(world.fire.x), fy = Math.floor(world.fire.y);
  dist[fy * w + fx] = 0;
  // a small binary heap keyed on distance
  const heap = [[0, fx, fy]];
  const push = (e) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, x, y] = pop();
    if (d > dist[y * w + x]) continue;
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      // no cutting a wall's corner diagonally
      if (dx && dy && (cost[y * w + nx] > 1 || cost[ny * w + x] > 1)) continue;   // (rubble too)
      const nd = d + cost[ny * w + nx] * (dx && dy ? 1.414 : 1);
      if (nd < dist[ny * w + nx]) {
        dist[ny * w + nx] = nd;
        push([nd, nx, ny]);
      }
    }
  }
  world.flow = dist;
  world.flowDirty = false;
  return dist;
}

// the neighbouring tile an enemy on (tx, ty) should head for, or null at the fire
export function nextTile(world, tx, ty) {
  const { w, h } = BAL.map, d = world.flow;
  let best = null, bd = d[ty * w + tx];
  for (const [dx, dy] of NB) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (dx && dy && (wallAt(world, nx, ty) || wallAt(world, tx, ny))) continue;
    if (d[ny * w + nx] < bd) {
      bd = d[ny * w + nx];
      best = [nx, ny];
    }
  }
  return best;
}
