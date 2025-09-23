// Use the new Tailwind PostCSS adapter when available (Tailwind v4+).
// Fall back to the classic 'tailwindcss' plugin if the adapter isn't installed.
// If neither is available, register a small plugin that removes `@tailwind` at-rules
// so PostCSS won't crash in environments where tailwind isn't installed.
const plugins = [];
try {
  // prefer the adapter package
  plugins.push(require('@tailwindcss/postcss'));
} catch (e1) {
  try {
    // fallback to classic tailwind package
    plugins.push(require('tailwindcss'));
  } catch (e2) {
    // last-resort: remove @tailwind at-rules so PostCSS doesn't error.
    // This means tailwind utilities won't be generated, but compilation will succeed.
    plugins.push(() => {
      return {
        postcssPlugin: 'strip-tailwind-at-rules',
        Once(root) {
          root.walkAtRules('tailwind', (rule) => rule.remove());
        },
      };
    });
  }
}
plugins.push(require('autoprefixer'));

module.exports = { plugins };
