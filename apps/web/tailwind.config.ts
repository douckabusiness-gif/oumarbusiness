import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080808",
        panel: "#101010",
        line: "#242424",
        gold: "#F5A623",
        amber: "#FFC24B",
        ember: "#FF7A18",
        muted: "#A7A7A7"
      },
      boxShadow: {
        glow: "0 0 40px rgba(245,166,35,0.18)",
        "glow-lg": "0 0 90px rgba(245,166,35,0.30)",
        gold: "0 18px 50px -14px rgba(245,166,35,0.55)"
      }
    }
  },
  plugins: []
};

export default config;
