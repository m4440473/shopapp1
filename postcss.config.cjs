// PostCSS config — use the Tailwind PostCSS adapter directly.
// Do not silently strip Tailwind directives here. If the adapter or Tailwind
// itself is missing, fail loudly with a helpful message so developers can
// install the required devDependencies (`pnpm install`).
try {
  // Next.js requires PostCSS plugins to be provided by name (object form)
  // so the build system can resolve and shape them correctly.
  module.exports = {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  };
} catch (err) {
  // Provide an explicit, actionable error message rather than silently
  // continuing with a broken build.
  // eslint-disable-next-line no-console
  console.error('\nMissing Tailwind/PostCSS modules required to build styles.');
  console.error('Install devDependencies: `pnpm install --save-dev tailwindcss postcss autoprefixer`');
  console.error('Then re-run your build or dev server.');
  throw err;
}
