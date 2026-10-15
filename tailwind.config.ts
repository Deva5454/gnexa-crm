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
        brand: {
          50: "#f1efff",
          100: "#e4e0ff",
          200: "#cbc3ff",
          300: "#a99bff",
          400: "#8a75fb",
          500: "#6d55f2",
          600: "#5a3fe0",
          700: "#4a32bd",
          800: "#3d2b98",
          900: "#332877",
        },
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
        aurora: "linear-gradient(120deg, #6d55f2 0%, #8a75fb 35%, #14b8a6 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
