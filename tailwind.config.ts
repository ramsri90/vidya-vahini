import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FBF7EF",
        surface: "#FFFFFF",
        ink: "#1F2937",
        "muted-text": "#6B7280",
        primary: {
          DEFAULT: "#0F766E",
          soft: "#CCFBF1",
        },
        theory: "#4F46E5",
        lab: "#D97706",
        success: "#15803D",
        warning: "#B45309",
        danger: "#B91C1C",
        border: "#E7E0D2",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        card: "14px",
        btn: "10px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
