import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // Gnexa palette: deep ink rail, violet primary, teal accent
        ink: {
          950: "#0b1020",
          900: "#111733",
          800: "#1a2247",
          700: "#26305e",
          600: "#3a4578",
        },
        // brand palette is CSS variables so Setup → Theme style can switch it (lib/theme.ts)
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, `rgb(var(--brand-${s}) / <alpha-value>)`])),
        accent: {
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
        },
        canvas: "#f4f6fb",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        pop: "0 12px 32px -8px rgba(17,23,51,.25)",
      },
      backgroundImage: {
        aurora: "linear-gradient(120deg, rgb(var(--brand-500)) 0%, rgb(var(--brand-400)) 35%, #14b8a6 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
