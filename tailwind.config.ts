import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        amato: {
          primary: "#9b87f5",
          secondary: "#7E69AB",
          background: "#F1F0FB",
        },
        border: "hsl(var(--border))",
      },
      animation: {
        "button-hover": "button-hover 0.3s ease-in-out",
      },
      keyframes: {
        "button-hover": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-3px)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;