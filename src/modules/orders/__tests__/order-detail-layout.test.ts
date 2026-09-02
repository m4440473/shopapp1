import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('order detail Parts rail layout', () => {
  const pageSource = readFileSync(resolve(process.cwd(), 'src/app/orders/[id]/page.tsx'), 'utf8');

  it('uses a customer-title-sized Parts heading without a translating card hover', () => {
    expect(pageSource).toContain('text-2xl font-semibold text-foreground">PARTS');
    expect(pageSource).not.toContain('hover:-translate-y-0.5');
    expect(pageSource).toContain('transition-[border-color,box-shadow,background-color]');
  });

  it('keeps the phone layout compact, touchable, and horizontally safe', () => {
    expect(pageSource).toContain('order-detail-page -mt-4 space-y-4 sm:mt-0 sm:space-y-6');
    expect(pageSource).toContain('overflow-x-auto pb-1 pr-1 lg:block');
    expect(pageSource).toContain('min-w-[min(18rem,calc(100vw-2rem))]');
    expect(pageSource).toContain('grid w-full grid-cols-2 gap-2 [&>*:last-child]:col-span-2 sm:flex');
    expect(pageSource).toContain('CardContent className="space-y-6 px-0 pb-6 pt-4 sm:px-6 sm:pt-6"');
  });
});
