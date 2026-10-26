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
        canvas: "var(--color-canvas)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "surface-hover": "var(--color-surface-hover)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        fg: "var(--color-fg)",
        "fg-muted": "var(--color-fg-muted)",
        "fg-subtle": "var(--color-fg-subtle)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        brand: "var(--color-brand)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        shell: "var(--radius-shell)",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        topbar: "var(--topbar-height)",
      },
      boxShadow: {
        composer: "var(--shadow-composer)",
      },
    },
  },
  plugins: [],
};

export default config;
