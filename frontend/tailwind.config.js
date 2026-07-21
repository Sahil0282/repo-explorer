/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Backgrounds (deepest -> elevated) ---
        base: "#0B0B0F",            // app background
        surface: {
          DEFAULT: "#15151E",      // panels, cards, inputs
          raised: "#1C1C28",       // hover / elevated cards
          sunken: "#0E0E14",       // insets, code areas
        },
        // --- Borders / strokes ---
        edge: {
          subtle: "#1E1E2A",       // hairline dividers
          DEFAULT: "#2A2A3A",      // default borders
          strong: "#3A3A4F",       // emphasized borders
        },
        // --- Text ---
        content: {
          primary: "#F4F4F5",      // headings, key text
          secondary: "#A1A1AA",    // body / secondary
          muted: "#71717A",        // labels, captions (AA on dark)
          faint: "#52525B",        // decorative / disabled hints
        },
        // --- Brand: indigo -> violet ---
        brand: {
          50: "#EEF2FF",
          400: "#818CF8",
          DEFAULT: "#6366F1",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          violet: "#A855F7",
        },
        // --- Semantic accents (promoted from the FocusMap type system) ---
        accent: {
          blue: "#60A5FA",
          teal: "#2DD4BF",
          amber: "#FBBF24",
          fuchsia: "#E879F9",
          green: "#34D399",   // additions / success
          red: "#F87171",     // deletions / errors
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6366F1 0%, #A855F7 100%)",
        "brand-radial":
          "radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 60%)",
      },
      // --- Radii tokens (semantic component radii) ---
      borderRadius: {
        btn: "0.75rem",   // buttons, inputs
        card: "1rem",     // cards, panels
        pill: "9999px",   // badges, chips
      },
      // --- Elevation tokens ---
      boxShadow: {
        "brand-glow": "0 0 24px -6px rgba(99,102,241,0.45)",
        "brand-glow-lg": "0 8px 40px -12px rgba(124,58,237,0.35)",
        card: "0 1px 3px rgba(0,0,0,0.4)",
        elevated: "0 12px 40px -12px rgba(0,0,0,0.65)",
      },
      // --- Motion tokens ---
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
}
