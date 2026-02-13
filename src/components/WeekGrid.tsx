import { useMemo } from "react";
import type { LifePeriod } from "../types";
import { getCellDate, findPeriod } from "../grid";

const BG_TO_TEXT: Record<string, string> = {
  "bg-rose-400": "text-rose-400",
  "bg-amber-400": "text-amber-400",
  "bg-emerald-400": "text-emerald-400",
  "bg-sky-400": "text-sky-400",
  "bg-violet-400": "text-violet-400",
  "bg-pink-400": "text-pink-400",
  "bg-lime-400": "text-lime-400",
  "bg-cyan-400": "text-cyan-400",
  "bg-orange-400": "text-orange-400",
  "bg-indigo-400": "text-indigo-400",
  "bg-gray-200": "text-gray-200",
};

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

  const labelRows = useMemo(() => {
    const ranges = new Map<LifePeriod, { first: number; last: number }>();
    rows.forEach(({ year, cells }) => {
      for (const { period } of cells) {
        if (period) {
          const existing = ranges.get(period);
          if (existing) {
            existing.last = year;
          } else {
            ranges.set(period, { first: year, last: year });
          }
        }
      }
    });

    const map = new Map<number, { label: string; textClass: string }>();
    for (const [period, { first, last }] of ranges) {
      const midRow = Math.floor((first + last) / 2);
      const bgClass = colorMap.get(period) ?? "bg-gray-200";
      const textClass = BG_TO_TEXT[bgClass] ?? "text-gray-200";
      map.set(midRow, { label: period.label, textClass });
    }

    return map;
  }, [rows, colorMap]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `max-content auto repeat(52, 1fr)` }}>
        {/* Title row */}
        <div className="col-span-2" />
        <div className="col-span-52 flex justify-between items-baseline mb-1" style={{ fontFamily: "Verdana" }}>
          <span className="text-lg font-bold text-gray-800">Memento mori</span>
          <span className="text-xs font-bold text-gray-400">(efficient life planning motivator)</span>
        </div>

        {/* Header row */}
        <div />
        <div className="w-8" />
        {Array.from({ length: 52 }, (_, i) => (
          <div
            key={`h-${i}`}
            className="text-[6px] text-gray-400 text-center w-2.5"
          >
            {(i + 1) % 5 === 0 ? i + 1 : ""}
          </div>
        ))}

        {/* Data rows */}
        {rows.map(({ year, cells }) => {
          const labelInfo = labelRows.get(year);
          return (
            <>
              <div
                key={`lbl-${year}`}
                className="pr-2 flex items-center justify-end"
              >
                {labelInfo && (
                  <span className={`text-[9px] leading-[10px] font-bold whitespace-nowrap ${labelInfo.textClass}`} style={{ fontFamily: "Impact" }}>
                    {labelInfo.label}
                  </span>
                )}
              </div>
              <div
                key={`year-${year}`}
                className="text-[8px] text-gray-500 pr-1 text-right leading-[10px] w-8"
              >
                {year % 5 === 0 ? year : ""}
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
          );
        })}
      </div>
    </div>
  );
}
