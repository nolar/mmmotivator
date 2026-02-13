import { useMemo, useState } from "react";
import { lifeConfig } from "./config";
import { assignColors } from "./colors";
import type { LifePeriod } from "./types";
import WeekGrid from "./components/WeekGrid";
import Legend from "./components/Legend";
import ConfigForm from "./components/ConfigForm";

function App() {
  const [birthdate, setBirthdate] = useState(lifeConfig.birthdate);
  const [totalYears, setTotalYears] = useState(lifeConfig.totalYears);
  const [periods, setPeriods] = useState<LifePeriod[]>(lifeConfig.periods);

  const birthdateObj = useMemo(() => new Date(birthdate), [birthdate]);
  const colorMap = useMemo(() => assignColors(periods), [periods]);

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Life in Weeks
      </h1>
      <div className="flex gap-8">
        <aside className="w-80 shrink-0">
          <ConfigForm
            birthdate={birthdate}
            setBirthdate={setBirthdate}
            totalYears={totalYears}
            setTotalYears={setTotalYears}
            periods={periods}
            setPeriods={setPeriods}
          />
        </aside>
        <main className="flex-1 min-w-0">
          <WeekGrid
            birthdate={birthdateObj}
            totalYears={totalYears}
            periods={periods}
            colorMap={colorMap}
          />
          <Legend periods={periods} colorMap={colorMap} />
        </main>
      </div>
    </div>
  );
}

export default App;
