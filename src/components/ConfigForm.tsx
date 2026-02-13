import { useRef, useState } from "react";
import type { LifePeriod } from "../types";
import { PALETTE } from "../colors";

const COLOR_LABELS: Record<string, string> = Object.fromEntries(
  PALETTE.map((c) => [c, c.replace("bg-", "").replace("-400", "")])
);

interface ConfigFormProps {
  birthdate: string;
  setBirthdate: (v: string) => void;
  totalYears: number;
  setTotalYears: (v: number) => void;
  periods: LifePeriod[];
  setPeriods: (v: LifePeriod[]) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export default function ConfigForm({
  birthdate,
  setBirthdate,
  totalYears,
  setTotalYears,
  periods,
  setPeriods,
  onSave,
  onExport,
  onImport,
  onReset,
}: ConfigFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openColorPicker, setOpenColorPicker] = useState<number | null>(null);

  const updatePeriod = (index: number, field: keyof LifePeriod, value: string) => {
    const updated = periods.map((p, i) => {
      if (i !== index) return p;
      if (field === "color" && !value) {
        const copy = { ...p };
        delete copy.color;
        return copy;
      }
      return { ...p, [field]: value };
    });
    setPeriods(updated);
  };

  const removePeriod = (index: number) => {
    setPeriods(periods.filter((_, i) => i !== index));
    onSave();
  };

  const addPeriod = () => {
    setPeriods([...periods, { label: "", start: "", end: "" }]);
    onSave();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = "";
    }
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
            onBlur={onSave}
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
            onBlur={onSave}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600">Life Periods</h3>

        {periods.map((period, i) => (
          <div key={i} className="rounded border border-gray-200 bg-gray-50 p-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setOpenColorPicker(openColorPicker === i ? null : i)}
                  className={`w-6 h-6 rounded-full shrink-0 border border-gray-300 ${period.color ?? "bg-gray-200"}`}
                  title={period.color ? COLOR_LABELS[period.color] ?? period.color : "Auto"}
                />
                {openColorPicker === i && (
                  <div className="absolute z-10 mt-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg grid grid-cols-4 gap-1 w-max">
                    <button
                      onClick={() => {
                        updatePeriod(i, "color", "");
                        onSave();
                        setOpenColorPicker(null);
                      }}
                      className={`w-5 h-5 rounded-full bg-gray-200 border-2 ${
                        !period.color ? "border-gray-800" : "border-transparent hover:border-gray-400"
                      }`}
                      title="Auto"
                    />
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          updatePeriod(i, "color", c);
                          onSave();
                          setOpenColorPicker(null);
                        }}
                        className={`w-5 h-5 rounded-full ${c} border-2 ${
                          period.color === c ? "border-gray-800" : "border-transparent hover:border-gray-400"
                        }`}
                        title={COLOR_LABELS[c]}
                      />
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Label"
                value={period.label}
                onChange={(e) => updatePeriod(i, "label", e.target.value)}
                onBlur={onSave}
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
                onBlur={onSave}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                type="date"
                value={period.end}
                onChange={(e) => updatePeriod(i, "end", e.target.value)}
                onBlur={onSave}
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

      <div className="space-y-2 border-t border-gray-200 pt-4">
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="flex-1 rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Import
          </button>
        </div>
        <button
          onClick={onReset}
          className="w-full rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Reset to defaults
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
