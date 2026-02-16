export interface LifePeriod {
  label: string;
  start: string; // ISO date "YYYY-MM-DD"
  end: string;   // ISO date "YYYY-MM-DD"
  color?: string; // Tailwind bg class, e.g. "bg-rose-400"
}

export interface DateMarker {
  date: string;   // ISO "YYYY-MM-DD"
  title: string;
  color?: string; // Tailwind bg class, e.g. "bg-rose-400"; dark gray when unset
}

export interface LifeConfig {
  birthdate: string;  // ISO date
  totalYears: number; // how many rows
  periods: LifePeriod[];
  dates: DateMarker[];
}
