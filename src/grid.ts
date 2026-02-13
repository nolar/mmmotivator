import type { LifePeriod } from "./types";

export function getCellDate(birthdate: Date, year: number, week: number): Date {
  const days = Math.floor(year * 365.25 + week * 7);
  const date = new Date(birthdate);
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
