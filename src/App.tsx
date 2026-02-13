import { useMemo } from "react";
import { lifeConfig } from "./config";
import { assignColors } from "./colors";
import WeekGrid from "./components/WeekGrid";
import Legend from "./components/Legend";

function App() {
  const birthdate = useMemo(() => new Date(lifeConfig.birthdate), []);
  const colorMap = useMemo(
    () => assignColors(lifeConfig.periods),
    []
  );

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Life in Weeks
      </h1>
      <WeekGrid
        birthdate={birthdate}
        totalYears={lifeConfig.totalYears}
        periods={lifeConfig.periods}
        colorMap={colorMap}
      />
      <Legend periods={lifeConfig.periods} colorMap={colorMap} />
    </div>
  );
}

export default App;
