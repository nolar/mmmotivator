import type { LifePeriod } from "../types";

interface ConfigFormProps {
  birthdate: string;
  setBirthdate: (v: string) => void;
  totalYears: number;
  setTotalYears: (v: number) => void;
  periods: LifePeriod[];
  setPeriods: (v: LifePeriod[]) => void;
}

export default function ConfigForm({
  birthdate,
  setBirthdate,
  totalYears,
  setTotalYears,
  periods,
  setPeriods,
}: ConfigFormProps) {
  const updatePeriod = (index: number, field: keyof LifePeriod, value: string) => {
    const updated = periods.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    setPeriods(updated);
  };

  const removePeriod = (index: number) => {
    setPeriods(periods.filter((_, i) => i !== index));
  };

  const addPeriod = () => {
    setPeriods([...periods, { label: "", start: "", end: "" }]);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-700">Configuration</h2>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-600">Birthdate</span>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-600">Total years</span>
          <input
            type="number"
            min={1}
            max={150}
            value={totalYears}
            onChange={(e) => setTotalYears(Number(e.target.value))}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600">Life Periods</h3>

        {periods.map((period, i) => (
          <div key={i} className="rounded border border-gray-200 bg-gray-50 p-2 space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Label"
                value={period.label}
                onChange={(e) => updatePeriod(i, "label", e.target.value)}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                onClick={() => removePeriod(i)}
                className="text-red-500 hover:text-red-700 text-sm px-1"
                title="Remove period"
              >
                &times;
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={period.start}
                onChange={(e) => updatePeriod(i, "start", e.target.value)}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                type="date"
                value={period.end}
                onChange={(e) => updatePeriod(i, "end", e.target.value)}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
        ))}

        <button
          onClick={addPeriod}
          className="w-full rounded border border-dashed border-gray-300 py-1 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
        >
          + Add period
        </button>
      </div>
    </div>
  );
}
