import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f4f7fb",
        primary: "#3A9AFF",
        "primary-strong": "#1F82EA",
        "primary-soft": "#EEF6FF",
        sky: "#3A9AFF",
        tide: "#1F82EA",
        coral: "#f97316",
        moss: "#0f766e",
        sand: "#fff7ed",
      },
      boxShadow: {
        panel:
          "0 28px 60px -32px rgba(58, 154, 255, 0.45), 0 16px 24px -18px rgba(15, 23, 42, 0.28)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
      },
      fontFamily: {
        body: ["var(--font-body)"],
        display: ["var(--font-display)"],
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
