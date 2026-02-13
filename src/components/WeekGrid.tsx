import { useMemo } from "react";
import type { LifePeriod } from "../types";
import { getCellDate, findPeriod } from "../grid";

interface WeekGridProps {
  birthdate: Date;
  totalYears: number;
  periods: LifePeriod[];
  colorMap: Map<LifePeriod, string>;
}

export default function WeekGrid({
  birthdate,
  totalYears,
  periods,
  colorMap,
}: WeekGridProps) {
  const rows = useMemo(() => {
    const result: Array<{
      year: number;
      cells: Array<{ period: LifePeriod | null; date: Date }>;
    }> = [];

    for (let y = 0; y < totalYears; y++) {
      const cells: Array<{ period: LifePeriod | null; date: Date }> = [];
      for (let w = 0; w < 52; w++) {
        const date = getCellDate(birthdate, y, w);
        const period = findPeriod(date, periods);
        cells.push({ period, date });
      }
      result.push({ year: y, cells });
    }

    return result;
  }, [birthdate, totalYears, periods]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(52, 1fr)` }}>
        {/* Header row */}
        <div className="w-8" />
        {Array.from({ length: 52 }, (_, i) => (
          <div
            key={`h-${i}`}
            className="text-[6px] text-gray-400 text-center w-2.5"
          >
            {i % 4 === 0 ? i : ""}
          </div>
        ))}

        {/* Data rows */}
        {rows.map(({ year, cells }) => (
          <>
            <div
              key={`label-${year}`}
              className="text-[8px] text-gray-500 pr-1 text-right leading-[10px] w-8"
            >
              {year}
            </div>
            {cells.map(({ period, date }, w) => {
              const bgClass = period ? colorMap.get(period) ?? "bg-gray-200" : "bg-gray-200";
              const tooltip = period
                ? `${period.label} — ${date.toLocaleDateString()}`
                : date.toLocaleDateString();
              return (
                <div
                  key={`${year}-${w}`}
                  className={`w-2.5 h-2.5 ${bgClass} hover:opacity-70 transition-opacity`}
                  title={tooltip}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
