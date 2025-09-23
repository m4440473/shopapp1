// Use the new Tailwind PostCSS adapter when available (Tailwind v4+).
// Fall back to the classic 'tailwindcss' plugin if the adapter isn't installed.
const plugins = [];
try {
  // prefer the adapter package
  plugins.push(require('@tailwindcss/postcss'));
} catch (e) {
  // fallback for environments that don't have the adapter installed
  plugins.push(require('tailwindcss'));
}
plugins.push(require('autoprefixer'));

module.exports = { plugins };
