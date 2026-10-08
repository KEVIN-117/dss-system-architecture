import { registerMap } from 'echarts/core';

import world from './assets/world.json' with { type: 'json' };

let registered = false;

/** Register Saiku's bundled Natural Earth map once, on demand. */
export function ensureWorldMapRegistered(): void {
  if (registered) return;
  registerMap('world', world as Parameters<typeof registerMap>[1]);
  registered = true;
}
