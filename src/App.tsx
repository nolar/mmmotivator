import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lifeConfig } from "./config";
import { loadConfig, saveConfig, exportConfigFile, importConfigFile } from "./storage";
import { assignColors } from "./colors";
import type { LifePeriod } from "./types";
import WeekGrid from "./components/WeekGrid";
import ConfigForm from "./components/ConfigForm";

const initialConfig = loadConfig() ?? lifeConfig;

function App() {
  const [birthdate, setBirthdate] = useState(initialConfig.birthdate);
  const [totalYears, setTotalYears] = useState(initialConfig.totalYears);
  const [periods, setPeriods] = useState<LifePeriod[]>(initialConfig.periods);

  const configRef = useRef({ birthdate, totalYears, periods });
  useEffect(() => {
    configRef.current = { birthdate, totalYears, periods };
  }, [birthdate, totalYears, periods]);

  const birthdateObj = useMemo(() => new Date(birthdate), [birthdate]);
  const colorMap = useMemo(() => assignColors(periods), [periods]);

  const requestSave = useCallback(() => {
    setTimeout(() => saveConfig(configRef.current), 0);
  }, []);

  const handleExport = () => {
    exportConfigFile({ birthdate, totalYears, periods });
  };

  const handleImport = async (file: File) => {
    try {
      const config = await importConfigFile(file);
      setBirthdate(config.birthdate);
      setTotalYears(config.totalYears);
      setPeriods(config.periods);
      saveConfig(config);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to import configuration");
    }
  };

  const handleReset = () => {
    setBirthdate(lifeConfig.birthdate);
    setTotalYears(lifeConfig.totalYears);
    setPeriods(lifeConfig.periods);
    saveConfig(lifeConfig);
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex gap-8">
        <aside className="w-80 shrink-0">
          <ConfigForm
            birthdate={birthdate}
            setBirthdate={setBirthdate}
            totalYears={totalYears}
            setTotalYears={setTotalYears}
            periods={periods}
            setPeriods={setPeriods}
            onSave={requestSave}
            onExport={handleExport}
            onImport={handleImport}
            onReset={handleReset}
          />
        </aside>
        <main className="flex-1 min-w-0">
          <WeekGrid
            birthdate={birthdateObj}
            totalYears={totalYears}
            periods={periods}
            colorMap={colorMap}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
