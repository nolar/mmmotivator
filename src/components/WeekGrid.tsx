import { forwardRef, useMemo } from "react";
import type { DateMarker, LifePeriod } from "../types";
import { buildGridRows, buildLabelRows, getDateMarkerRow, getDateMarkerCell } from "../grid";
import { BG_TO_TEXT, BG_TO_BORDER } from "../colors";

interface WeekGridProps {
  birthdate: Date;
  totalYears: number;
  periods: LifePeriod[];
  colorMap: Map<LifePeriod, string>;
  dates: DateMarker[];
}

const WeekGrid = forwardRef<HTMLDivElement, WeekGridProps>(function WeekGrid({
  birthdate,
  totalYears,
  periods,
  colorMap,
  dates,
}, ref) {
  const rows = useMemo(
    () => buildGridRows(birthdate, totalYears, periods),
    [birthdate, totalYears, periods]
  );

  const labelRows = useMemo(
    () => buildLabelRows(rows, colorMap, BG_TO_TEXT),
    [rows, colorMap]
  );

  const dateMarkerRows = useMemo(() => {
    const map = new Map<number, DateMarker>();
    for (const d of dates) {
      if (!d.date) continue;
      const row = getDateMarkerRow(birthdate, d.date);
      if (row >= 0 && row < totalYears) {
        map.set(row, d);
      }
    }
    return map;
  }, [dates, birthdate, totalYears]);

  const starCells = useMemo(() => {
    const set = new Set<string>();
    for (const d of dates) {
      if (!d.date) continue;
      const { row, week } = getDateMarkerCell(birthdate, d.date);
      if (row >= 0 && row < totalYears) {
        set.add(`${row}-${week}`);
      }
    }
    return set;
  }, [dates, birthdate, totalYears]);

  return (
    <div ref={ref} className="overflow-x-auto pt-4 pb-4">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `5ch 1ch repeat(52, 1fr) 5ch` }}>
        {/* Title row */}
        <div className="col-span-2" />
        <div className="col-span-52 flex justify-between items-baseline mb-1" style={{ fontFamily: "Verdana" }}>
          <span className="text-lg font-bold text-gray-800">Memento mori</span>
          <span className="text-xs font-bold text-gray-400">(efficient life planning motivator)</span>
        </div>
        <div />

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
        <div />

        {/* Data rows */}
        {rows.map(({ year, cells }) => {
          const labelInfo = labelRows.get(year);
          const marker = dateMarkerRows.get(year);
          const markerColor = marker?.color ?? "bg-gray-400";
          const borderColor = BG_TO_BORDER[markerColor] ?? "border-gray-400";
          const textColor = BG_TO_TEXT[markerColor] ?? "text-gray-400";
          return (
            <>
              <div
                key={`lbl-${year}`}
                className="pr-0.5 flex items-center justify-end max-w-[5ch] overflow-hidden"
              >
                {labelInfo && (
                  <span className={`text-[9px] leading-[10px] font-bold whitespace-nowrap ${labelInfo.textClass}`} style={{ fontFamily: "Impact" }}>
                    {labelInfo.label}
                  </span>
                )}
              </div>
              <div
                key={`year-${year}`}
                className="text-[8px] text-gray-500 pr-1 text-right leading-[10px] w-[2em]"
              >
                {year % 5 === 0 ? year : ""}
              </div>
              {cells.map(({ period, date }, w) => {
                const bgClass = period ? colorMap.get(period) ?? "bg-gray-200" : "bg-gray-200";
                const tooltip = period
                  ? `${period.label} — ${date.toLocaleDateString()}`
                  : date.toLocaleDateString();
                const hasStar = starCells.has(`${year}-${w}`);
                return (
                  <div
                    key={`${year}-${w}`}
                    className={`w-2.5 h-2.5 ${bgClass} hover:opacity-70 transition-opacity relative overflow-visible`}
                    title={tooltip}
                  >
                    {hasStar && (
                      <svg viewBox="0 0 20 20" className="absolute" style={{ width: "150%", height: "150%", left: "-25%", top: "-25%" }}>
                        <polygon
                          points="10,1 12.4,7.6 19.5,7.6 13.5,12.4 15.9,19 10,15 4.1,19 6.5,12.4 0.5,7.6 7.6,7.6"
                          fill="#ef4444"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
              <div
                key={`ann-${year}`}
                className={`flex items-center justify-end pl-0.5 h-2.5${marker ? ` border-t-2 ${borderColor}` : ""}`}
              >
                {marker && (
                  <span className={`text-[9px] leading-[10px] font-bold whitespace-nowrap ${textColor}`} style={{ fontFamily: "Impact" }}>
                    {marker.title}
                  </span>
                )}
              </div>
            </>
          );
        })}

        {/* Footer */}
        <div className="col-span-2" />
        <div className="col-span-52 text-right">
          <span className="text-[10px] text-black" style={{ fontFamily: "Verdana" }}>Generated with <a href="https://mmmotivator.com" className="text-black underline">mmmotivator.com</a></span>
        </div>
        <div />
      </div>
    </div>
  );
});

export default WeekGrid;
