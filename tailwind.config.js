/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./app/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      colors: {
        "neo-bg": "#FFFDF5",
        "neo-ink": "#000000",
        "neo-accent": "#FF6B6B",
        "neo-secondary": "#FFD93D",
        "neo-muted": "#C4B5FD",
      },
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        "neo-sm": "4px 4px 0px 0px #000",
        "neo-md": "8px 8px 0px 0px #000",
        "neo-lg": "12px 12px 0px 0px #000",
        "neo-xl": "16px 16px 0px 0px #000",
      },
      animation: {
        "spin-slow": "spin-slow 10s linear infinite",
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};
