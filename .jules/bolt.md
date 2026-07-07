
## 2026-07-07 - [JS Map as LRU Cache]
**Learning:** For interactive UI components that perform heavy repetitive math (like the 61-day timeline scrubber triggering `calculateTransits` inside `src/lib/astrology.ts`), relying solely on React `useEffect` debouncing is insufficient because multiple scrubber ticks re-evaluate the same sequence of dates rapidly. A vanilla `Map` handles LRU cleanly and quickly by combining `delete` and `set` on access to push the most recently used items to the end of its iteration order, turning O(ms) calculations into ~0ms.
**Action:** When implementing heavy computational logic bound to dynamic scrubber inputs, apply an internal LRU cache via `Map` directly on the utility side rather than just throttling the UI/React side.
