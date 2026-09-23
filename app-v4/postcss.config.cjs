const path = require("path");

module.exports = {
  plugins: {
    // Absolute path so the V4 build never picks up the repo-root legacy config.
    tailwindcss: { config: path.resolve(__dirname, "tailwind.config.cjs") }
  }
};
