import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global print chrome rules', () => {
  const globalsCss = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
  const rootLayout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');

  it('hides only app chrome instead of every semantic document header and footer', () => {
    expect(globalsCss).toContain('[data-app-chrome]');
    expect(globalsCss).not.toMatch(/header\s*,\s*footer\s*\{\s*display:\s*none\s*!important/);
    expect(rootLayout.match(/data-app-chrome/g)).toHaveLength(2);
  });
});
