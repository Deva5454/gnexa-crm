// Setup → Theme style: brand colour presets. The brand palette is CSS variables (see tailwind.config.ts and
// globals.css); the app and portal layouts write the chosen preset's values onto :root.

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const palette = (...c: string[]) => Object.fromEntries(SHADES.map((s, i) => [s, c[i]!])) as Record<(typeof SHADES)[number], string>;

export const THEMES = {
  violet: { label: "Violet (Gnexa)", colors: palette("#f1efff", "#e4e0ff", "#cbc3ff", "#a99bff", "#8a75fb", "#6d55f2", "#5a3fe0", "#4a32bd", "#3d2b98", "#332877") },
  indigo: { label: "Indigo", colors: palette("#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81") },
  blue: { label: "Blue", colors: palette("#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a") },
  teal: { label: "Teal", colors: palette("#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a") },
  emerald: { label: "Emerald", colors: palette("#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b") },
  rose: { label: "Rose", colors: palette("#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337") },
  orange: { label: "Orange", colors: palette("#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12") },
  slate: { label: "Graphite", colors: palette("#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a") },
} as const;

export type ThemeKey = keyof typeof THEMES;

/** CSS that sets the brand palette for a preset (the default violet comes from globals.css). */
export function themeCss(key: string | null | undefined) {
  const t = THEMES[(key ?? "violet") as ThemeKey] ?? THEMES.violet;
  return `:root{${SHADES.map((s) => `--brand-${s}:${hex(t.colors[s])}`).join(";")}}`;
}
