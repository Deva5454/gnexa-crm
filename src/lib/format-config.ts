// Setup → Settings → Numbering & dates: how document numbers and dates are printed everywhere.
// One install = one company, so the server keeps the current settings in this module (loaded with the
// signed-in user, see lib/format-server.ts) and the layouts hand the same values to the browser (FormatSync).

export type FormatConfig = {
  prefixes: { proposal: string; estimate: string; invoice: string; credit_note: string };
  padding: number;
  dateFormat: string;
};

export const DATE_FORMATS = [
  { value: "dd MMM yyyy", label: "17 Oct 2026" },
  { value: "dd/MM/yyyy", label: "17/10/2026" },
  { value: "MM/dd/yyyy", label: "10/17/2026" },
  { value: "yyyy-MM-dd", label: "2026-10-17" },
  { value: "dd-MM-yyyy", label: "17-10-2026" },
  { value: "dd.MM.yyyy", label: "17.10.2026" },
] as const;

export const DEFAULT_FORMAT: FormatConfig = {
  prefixes: { proposal: "PRO", estimate: "EST", invoice: "INV", credit_note: "CN" },
  padding: 5,
  dateFormat: "dd MMM yyyy",
};

let current: FormatConfig = DEFAULT_FORMAT;
export const formatConfig = () => current;
export function setFormatConfig(c: FormatConfig) {
  current = c;
}

/** The format_settings() result (or anything else) → a complete, valid config. */
export function parseFormat(raw: unknown): FormatConfig {
  const r = (raw ?? {}) as { prefixes?: Partial<FormatConfig["prefixes"]>; padding?: number; date_format?: string };
  const pre = (k: keyof FormatConfig["prefixes"]) => (typeof r.prefixes?.[k] === "string" && r.prefixes[k] ? r.prefixes[k]! : DEFAULT_FORMAT.prefixes[k]);
  const padding = Number(r.padding);
  return {
    prefixes: { proposal: pre("proposal"), estimate: pre("estimate"), invoice: pre("invoice"), credit_note: pre("credit_note") },
    padding: Number.isInteger(padding) && padding >= 1 && padding <= 10 ? padding : DEFAULT_FORMAT.padding,
    dateFormat: DATE_FORMATS.some((f) => f.value === r.date_format) ? r.date_format! : DEFAULT_FORMAT.dateFormat,
  };
}
