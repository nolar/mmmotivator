export interface LifePeriod {
  label: string;
  start: string; // ISO date "YYYY-MM-DD"
  end: string;   // ISO date "YYYY-MM-DD"
}

export interface LifeConfig {
  birthdate: string;  // ISO date
  totalYears: number; // how many rows
  periods: LifePeriod[];
}
