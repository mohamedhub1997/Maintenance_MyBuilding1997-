/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0B1120",
        surface: "#1E293B",
        surface2: "#334155",
        border: "#334155",
        accent: {
          DEFAULT: "#10B981",
          hover: "#059669",
          muted: "rgba(16,185,129,0.15)",
        },
      },
      fontFamily: {
        display: ['"Cabinet Grotesk"', '"Manrope"', "system-ui", "sans-serif"],
        sans: ['"Manrope"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
