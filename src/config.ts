import type { LifeConfig } from "./types";

export const lifeConfig: LifeConfig = {
  birthdate: "1990-06-15",
  totalYears: 90,
  periods: [
    { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
    { label: "School", start: "1997-09-01", end: "2008-06-30" },
    { label: "University", start: "2008-09-01", end: "2013-06-30" },
    { label: "First Job", start: "2013-07-01", end: "2017-03-31" },
    { label: "Startup", start: "2017-04-01", end: "2020-12-31" },
    { label: "Big Tech", start: "2021-01-01", end: "2025-12-31" },
    { label: "Freelance", start: "2026-01-01", end: "2030-06-14" },
  ],
};
