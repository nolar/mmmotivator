import { useState } from "react";
import type { DateMarker } from "../types";
import { PALETTE } from "../colors";

const COLOR_LABELS: Record<string, string> = Object.fromEntries(
  PALETTE.map((c) => [c, c.replace("bg-", "").replace("-400", "")])
);

interface DateFormProps {
  dates: DateMarker[];
  setDates: (v: DateMarker[]) => void;
  totalYears: number;
  setTotalYears: (v: number) => void;
  onSave: () => void;
}

export default function DateForm({ dates, setDates, totalYears, setTotalYears, onSave }: DateFormProps) {
  const [openColorPicker, setOpenColorPicker] = useState<number | null>(null);

  const updateDate = (index: number, field: keyof DateMarker, value: string) => {
    const updated = dates.map((d, i) => {
      if (i !== index) return d;
      if (field === "color" && !value) {
        const copy = { ...d };
        delete copy.color;
        return copy;
      }
      return { ...d, [field]: value };
    });
    setDates(updated);
  };

  const removeDate = (index: number) => {
    setDates(dates.filter((_, i) => i !== index));
    onSave();
  };

  const addDate = () => {
    setDates([...dates, { date: "", title: "" }]);
    onSave();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600">Dates</h3>
        {dates.map((d, i) => (
          <div key={i} className="rounded border border-gray-200 bg-gray-50 p-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setOpenColorPicker(openColorPicker === i ? null : i)}
                  className={`w-6 h-6 rounded-full shrink-0 border border-gray-300 ${d.color ?? "bg-gray-400"}`}
                  title={d.color ? COLOR_LABELS[d.color] ?? d.color : "Dark gray"}
                />
                {openColorPicker === i && (
                  <div className="absolute z-10 mt-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg grid grid-cols-4 gap-1 w-max">
                    <button
                      onClick={() => {
                        updateDate(i, "color", "");
                        onSave();
                        setOpenColorPicker(null);
                      }}
                      className={`w-5 h-5 rounded-full bg-gray-400 border-2 ${
                        !d.color ? "border-gray-800" : "border-transparent hover:border-gray-400"
                      }`}
                      title="Dark gray"
                    />
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          updateDate(i, "color", c);
                          onSave();
                          setOpenColorPicker(null);
                        }}
                        className={`w-5 h-5 rounded-full ${c} border-2 ${
                          d.color === c ? "border-gray-800" : "border-transparent hover:border-gray-400"
                        }`}
                        title={COLOR_LABELS[c]}
                      />
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Title e.g. 🇩🇪"
                value={d.title}
                onChange={(e) => updateDate(i, "title", e.target.value)}
                onBlur={onSave}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                onClick={() => removeDate(i)}
                className="text-red-500 hover:text-red-700 text-sm px-1"
                title="Remove date"
              >
                &times;
              </button>
            </div>
            <input
              type="date"
              value={d.date}
              onChange={(e) => updateDate(i, "date", e.target.value)}
              onBlur={onSave}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        ))}

        <button
          onClick={addDate}
          className="w-full rounded border border-dashed border-gray-300 py-1 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
        >
          + Add date
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-600">Total years</span>
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
    </div>
  );
}
