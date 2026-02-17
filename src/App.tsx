import { useCallback, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { lifeConfig } from "./config";
import { loadConfig, saveConfig, exportConfigFile, importConfigFile } from "./storage";
import { assignColors } from "./colors";
import type { DateMarker, LifePeriod } from "./types";
import WeekGrid from "./components/WeekGrid";
import ConfigForm from "./components/ConfigForm";
import DateForm from "./components/DateForm";
import SiteFooter from "./components/SiteFooter";

const initialConfig = loadConfig() ?? lifeConfig;

function App() {
  const [birthdate, setBirthdate] = useState(initialConfig.birthdate);
  const [totalYears, setTotalYears] = useState(initialConfig.totalYears);
  const [periods, setPeriods] = useState<LifePeriod[]>(initialConfig.periods);
  const [dates, setDates] = useState<DateMarker[]>(initialConfig.dates ?? []);
  const [showToday, setShowToday] = useState(initialConfig.showToday ?? true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const birthdateObj = useMemo(() => new Date(birthdate), [birthdate]);
  const colorMap = useMemo(() => assignColors(periods), [periods]);
  const effectiveDates = useMemo(() => {
    if (!showToday) return dates;
    const todayMarker: DateMarker = { date: new Date().toISOString().slice(0, 10), title: "You are here" };
    return [todayMarker, ...dates];
  }, [showToday, dates]);

  const requestSave = useCallback(() => {
    saveConfig({ birthdate, totalYears, periods, dates, showToday });
  }, [birthdate, totalYears, periods, dates, showToday]);

  const handleExport = () => {
    exportConfigFile({ birthdate, totalYears, periods, dates, showToday });
  };

  const handleImport = async (file: File) => {
    try {
      const config = await importConfigFile(file);
      setBirthdate(config.birthdate);
      setTotalYears(config.totalYears);
      setPeriods(config.periods);
      setDates(config.dates ?? []);
      setShowToday(config.showToday ?? true);
      saveConfig(config);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to import configuration");
    }
  };

  const handleDownloadPng = async () => {
    if (!gridRef.current) return;
    const dataUrl = await toPng(gridRef.current, { backgroundColor: "#ffffff", skipFonts: true, pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = "life-in-weeks.png";
    link.href = dataUrl;
    link.click();
  };

  const handleReset = () => {
    setBirthdate(lifeConfig.birthdate);
    setTotalYears(lifeConfig.totalYears);
    setPeriods(lifeConfig.periods);
    setDates(lifeConfig.dates);
    setShowToday(lifeConfig.showToday ?? true);
    saveConfig(lifeConfig);
  };

  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center min-w-[1400px] print:p-0 print:min-w-0">
      <div className="flex gap-8 shrink-0 print:block print:w-full">
        <aside className="w-80 shrink-0 print:hidden">
          <ConfigForm
            birthdate={birthdate}
            setBirthdate={setBirthdate}
            periods={periods}
            setPeriods={setPeriods}
            onSave={requestSave}
          />
        </aside>
        <main className="shrink-0 print:w-full print:mx-auto">
          <WeekGrid
            ref={gridRef}
            birthdate={birthdateObj}
            totalYears={totalYears}
            periods={periods}
            colorMap={colorMap}
            dates={effectiveDates}
          />
          <div className="flex gap-2 mt-4 justify-center print:hidden">
            <button
              onClick={handleDownloadPng}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Download PNG
            </button>
            <button
              onClick={handleExport}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Import
            </button>
            <button
              onClick={handleReset}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Reset to defaults
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                  e.target.value = "";
                }
              }}
              className="hidden"
            />
          </div>
          <div className="mt-3 text-center print:hidden">
            <p className="text-sm text-gray-500 mb-2">If you like the app, please support the author with bread &amp; beer:</p>
            <div className="flex gap-2 justify-center">
              <a
                href="https://github.com/sponsors/nolar/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Sponsor via GitHub
              </a>
              <a
                href="https://paypal.me/nolarinfo"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Sponsor via PayPal
              </a>
              <a
                href="https://buymeacoffee.com/nolar"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Buy Me a Coffee
              </a>
            </div>
          </div>
        </main>
        <aside className="w-64 shrink-0 print:hidden">
          <DateForm
            dates={dates}
            setDates={setDates}
            totalYears={totalYears}
            setTotalYears={setTotalYears}
            showToday={showToday}
            setShowToday={setShowToday}
            onSave={requestSave}
          />
        </aside>
      </div>
      <SiteFooter />
    </div>
  );
}

export default App;
