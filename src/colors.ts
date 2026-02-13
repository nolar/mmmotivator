import type { LifePeriod } from "./types";

const PALETTE = [
  "bg-rose-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-violet-400",
  "bg-pink-400",
  "bg-lime-400",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-indigo-400",
];

export function assignColors(periods: LifePeriod[]): Map<LifePeriod, string> {
  const sorted = [...periods].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const map = new Map<LifePeriod, string>();
  let lastColor = "";
  let colorIndex = 0;

  for (const period of sorted) {
    let color = PALETTE[colorIndex % PALETTE.length];
    if (color === lastColor) {
      colorIndex++;
      color = PALETTE[colorIndex % PALETTE.length];
    }
    map.set(period, color);
    lastColor = color;
    colorIndex++;
  }

  return map;
}
