/** Tailwind config scoped to the V4 app only; never scans legacy js/html. */
/** Brand colors and font families mirror the repo-root tailwind.config.cjs. */
module.exports = {
  // relative: true resolves globs against this config file's directory, not
  // the process cwd, so the V4 build never picks up legacy root files.
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{ts,tsx}"]
  },
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#b88a7f",
        "primary-dark": "#966a60",
        "surface-light": "#faf8f5",
        "surface-dark": "#292524",
        "background-light": "#f7f7f6",
        "background-dark": "#1c1716"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        display: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ]
};
