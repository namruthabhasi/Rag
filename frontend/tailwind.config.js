/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#050505", // Main background
        "background-landing": "#030303",
        surface: "rgba(255,255,255,0.04)",
        "surface-hover": "rgba(255,255,255,0.08)",
        border: "rgba(255,255,255,0.08)",
        "border-hover": "rgba(255,255,255,0.15)",
        primaryText: "#F5F5F5",
        secondaryText: "#9E9E9E",
        accentStart: "#9EA9FF",
        accentMiddle: "#D8D3FF",
        accentEnd: "#FFB3C7",
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(to right, #9EA9FF, #D8D3FF, #FFB3C7)',
      },
      animation: {
        'shimmer': 'shimmer 2.5s infinite linear',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

