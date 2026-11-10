"use client";

import { CLUB_COLOR_PRESETS, ROUTA_COLOR, isHexColor } from "@/lib/club-colors";

/** Cores prontas + "Outra cor". Comum à Página do clube e à Aparência do admin. */
export function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {CLUB_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.hex}
          type="button"
          onClick={() => onChange(preset.hex)}
          aria-label={preset.label}
          aria-pressed={value === preset.hex}
          title={preset.label}
          disabled={disabled}
          className="h-9 w-9 rounded-full border border-line-strong ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink disabled:opacity-50"
          style={{ backgroundColor: preset.hex }}
        />
      ))}
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm">
        <input
          type="color"
          value={isHexColor(value) ? value : ROUTA_COLOR}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          disabled={disabled}
          className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
        />
        Outra cor
      </label>
    </div>
  );
}
