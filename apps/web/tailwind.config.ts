import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0e14",
          900: "#10161f",
          800: "#1a2230",
          700: "#263142",
        },
        mirror: "#7dd3fc",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
