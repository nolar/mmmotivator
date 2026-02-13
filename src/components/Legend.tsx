import type { LifePeriod } from "../types";

interface LegendProps {
  periods: LifePeriod[];
  colorMap: Map<LifePeriod, string>;
}

export default function Legend({ periods, colorMap }: LegendProps) {
  const sorted = [...periods].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <div className="flex flex-wrap gap-4 mt-6">
      {sorted.map((period) => {
        const bgClass = colorMap.get(period) ?? "bg-gray-200";
        return (
          <div key={period.label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded ${bgClass}`} />
            <span className="text-sm text-gray-700">{period.label}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded bg-gray-200" />
        <span className="text-sm text-gray-700">Unassigned</span>
      </div>
    </div>
  );
}
