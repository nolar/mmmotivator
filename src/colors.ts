import type { LifePeriod } from "./types";

// Tailwind requires literal class strings — do not construct dynamically.
const COLOR_PAIRS: [bg: string, text: string][] = [
  ["bg-rose-400", "text-rose-400"],
  ["bg-amber-400", "text-amber-400"],
  ["bg-emerald-400", "text-emerald-400"],
  ["bg-sky-400", "text-sky-400"],
  ["bg-violet-400", "text-violet-400"],
  ["bg-pink-400", "text-pink-400"],
  ["bg-lime-400", "text-lime-400"],
  ["bg-cyan-400", "text-cyan-400"],
  ["bg-orange-400", "text-orange-400"],
  ["bg-indigo-400", "text-indigo-400"],
];

export const PALETTE = COLOR_PAIRS.map(([bg]) => bg);

export const BG_TO_TEXT: Record<string, string> = Object.fromEntries([
  ...COLOR_PAIRS,
  ["bg-gray-200", "text-gray-200"],
]);

const BORDER_PAIRS: [bg: string, border: string][] = [
  ["bg-rose-400", "border-rose-400"],
  ["bg-amber-400", "border-amber-400"],
  ["bg-emerald-400", "border-emerald-400"],
  ["bg-sky-400", "border-sky-400"],
  ["bg-violet-400", "border-violet-400"],
  ["bg-pink-400", "border-pink-400"],
  ["bg-lime-400", "border-lime-400"],
  ["bg-cyan-400", "border-cyan-400"],
  ["bg-orange-400", "border-orange-400"],
  ["bg-indigo-400", "border-indigo-400"],
];

export const BG_TO_BORDER: Record<string, string> = Object.fromEntries([
  ...BORDER_PAIRS,
  ["bg-gray-400", "border-gray-400"],
]);

export function assignColors(periods: LifePeriod[]): Map<LifePeriod, string> {
  const sorted = [...periods].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const map = new Map<LifePeriod, string>();
  let lastColor = "";
  let colorIndex = 0;

  for (const period of sorted) {
    if (period.color) {
      map.set(period, period.color);
      lastColor = period.color;
    } else {
      let color = PALETTE[colorIndex % PALETTE.length];
      if (color === lastColor) {
        colorIndex++;
        color = PALETTE[colorIndex % PALETTE.length];
      }
      map.set(period, color);
      lastColor = color;
      colorIndex++;
    }
  }

  return map;
}
