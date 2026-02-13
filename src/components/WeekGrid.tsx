import { useMemo } from "react";
import type { LifePeriod } from "../types";
import { buildGridRows, buildLabelRows } from "../grid";
import { BG_TO_TEXT } from "../colors";

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
  const rows = useMemo(
    () => buildGridRows(birthdate, totalYears, periods),
    [birthdate, totalYears, periods]
  );

  const labelRows = useMemo(
    () => buildLabelRows(rows, colorMap, BG_TO_TEXT),
    [rows, colorMap]
  );

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
