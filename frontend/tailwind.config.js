/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        yd: {
          bg: "#FAF7F1",
          forest: "#183C2B",
          green: "#287A43",
          "green-dark": "#1F5F34",
          saffron: "#D85B0B",
          orange: "#E87516",
          cream: "#F3E7D3",
          terracotta: "#B94E27",
          ink: "#171717",
          muted: "#6F6A63",
          border: "#E7DED2",
          success: "#27834A",
          error: "#C63C32",
        },
        /* Backward-compatible aliases remapped to new identity */
        saffron: {
          50: "#FFF4EB",
          100: "#FFE4D1",
          200: "#FFC9A3",
          300: "#F5A56B",
          400: "#E87516",
          500: "#D85B0B",
          600: "#D85B0B",
          700: "#B94E27",
        },
        sage: {
          50: "#EEF7F1",
          100: "#D5EBDD",
          500: "#287A43",
          600: "#287A43",
          700: "#183C2B",
        },
        cream: {
          50: "#FAF7F1",
          100: "#F3E7D3",
          200: "#E7DED2",
        },
        charcoal: {
          700: "#6F6A63",
          800: "#3A3530",
          900: "#171717",
        },
      },
      fontFamily: {
        display: ["\"Playfair Display\"", "Georgia", "serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: {
        store: "1440px",
      },
      boxShadow: {
        card: "0 8px 24px rgba(24, 60, 43, 0.06)",
        soft: "0 2px 10px rgba(24, 60, 43, 0.05)",
      },
      borderRadius: {
        card: "16px",
        sheet: "20px",
      },
      keyframes: {
        cartPop: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.28)" },
          "55%": { transform: "scale(0.94)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        cartPop: "cartPop 420ms cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
