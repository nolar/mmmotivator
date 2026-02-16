import type { LifePeriod } from "./types";

export function getCellDate(birthdate: Date, year: number, week: number): Date {
  const days = Math.floor(year * 365.25 + week * 7);
  const date = new Date(birthdate.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

export function findPeriod(
  date: Date,
  periods: LifePeriod[]
): LifePeriod | null {
  for (const period of periods) {
    const start = new Date(period.start);
    const end = new Date(period.end);
    if (date >= start && date <= end) {
      return period;
    }
  }
  return null;
}

export interface GridRow {
  year: number;
  cells: Array<{ period: LifePeriod | null; date: Date }>;
}

export function buildGridRows(
  birthdate: Date,
  totalYears: number,
  periods: LifePeriod[]
): GridRow[] {
  const result: GridRow[] = [];
  for (let y = 0; y < totalYears; y++) {
    const cells: GridRow["cells"] = [];
    for (let w = 0; w < 52; w++) {
      const date = getCellDate(birthdate, y, w);
      const period = findPeriod(date, periods);
      cells.push({ period, date });
    }
    result.push({ year: y, cells });
  }
  return result;
}

export function getDateMarkerRow(birthdate: Date, dateStr: string): number {
  const marker = new Date(dateStr);
  const diffMs = marker.getTime() - birthdate.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

export function getDateMarkerCell(birthdate: Date, dateStr: string): { row: number; week: number } {
  const marker = new Date(dateStr);
  const diffDays = (marker.getTime() - birthdate.getTime()) / (24 * 60 * 60 * 1000);
  const row = Math.floor(diffDays / 365.25);
  const dayInYear = diffDays - row * 365.25;
  const week = Math.min(Math.floor(dayInYear / 7), 51);
  return { row, week };
}

export function buildLabelRows(
  rows: GridRow[],
  colorMap: Map<LifePeriod, string>,
  bgToText: Record<string, string>
): Map<number, { label: string; textClass: string }> {
  const ranges = new Map<LifePeriod, { first: number; last: number }>();
  for (const { year, cells } of rows) {
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
  }

  const map = new Map<number, { label: string; textClass: string }>();
  for (const [period, { first, last }] of ranges) {
    const midRow = Math.floor((first + last) / 2);
    const bgClass = colorMap.get(period) ?? "bg-gray-200";
    const textClass = bgToText[bgClass] ?? "text-gray-200";
    map.set(midRow, { label: period.label, textClass });
  }
  return map;
}
