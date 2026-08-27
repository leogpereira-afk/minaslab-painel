/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        /* Marca MinasLab — o verde-agua e o azul-petroleo do logo.
           AS ESCALAS VAO INTEIRAS (licao da Impresilk): o Tailwind descarta
           classe desconhecida SEM ERRO, e uma escala com buraco faz o sinal
           sumir exatamente no estado que ele existia para gritar. */
        brand: {
          DEFAULT: "#0e9f8f",
          ink: "#24444f",
          50: "#effaf8",
          100: "#d5f3ee",
          200: "#aee7df",
          300: "#79d4c8",
          400: "#43bcae",
          500: "#16a897",
          600: "#0e9f8f",
          700: "#0f7f74",
          800: "#11655d",
          900: "#12534d",
        },
        ok: {
          DEFAULT: "#16a34a",
          50: "#effdf4", 100: "#d9fbe6", 200: "#bbf7d0", 300: "#86efac",
          400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d",
          800: "#166534", 900: "#14532d",
        },
        warn: {
          DEFAULT: "#d97706",
          50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d",
          400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309",
          800: "#92400e", 900: "#78350f",
        },
        bad: {
          DEFAULT: "#dc2626",
          50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5",
          400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c",
          800: "#991b1b", 900: "#7f1d1d",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 40, 46, 0.05), 0 4px 16px rgba(20, 40, 46, 0.06)",
        "card-hover": "0 2px 4px rgba(20, 40, 46, 0.06), 0 10px 28px rgba(20, 40, 46, 0.10)",
      },
    },
  },
  plugins: [],
};
