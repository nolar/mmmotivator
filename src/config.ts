import type { LifeConfig } from "./types";

export const lifeConfig: LifeConfig = {
  birthdate: "1986-06-15",
  totalYears: 90,
  periods: [
    { label: "Childhood", start: "1986-06-15", end: "1993-08-31" },
    { label: "School", start: "1993-09-01", end: "2004-06-30" },
    { label: "University", start: "2004-09-01", end: "2009-06-30" },
    { label: "First Job", start: "2009-07-01", end: "2013-03-31" },
    { label: "Startup", start: "2013-04-01", end: "2016-12-31" },
    { label: "Big Tech", start: "2017-01-01", end: "2021-12-31" },
    { label: "Freelance", start: "2022-01-01", end: "2026-06-14" },
  ],
  dates: [
    { date: "2009-07-01", title: "Career" },
    { date: "2016-12-15", title: "PhD" },
    { date: "2019-09-15", title: "🇺🇸" },
    { date: "2053-06-15", title: "Retirement" },
  ],
  showToday: true,
};
