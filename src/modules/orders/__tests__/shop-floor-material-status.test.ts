import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Shop Floor material status tile editor', () => {
  const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/ShopFloorLayouts.tsx'), 'utf8');
  const repoSource = readFileSync(resolve(process.cwd(), 'src/modules/orders/orders.repo.ts'), 'utf8');

  it('loads part identity and material status for Shop Floor orders', () => {
    expect(repoSource).toContain('materialStatus: true');
    expect(repoSource).toContain('partName: true');
  });

  it('offers every material state and saves through the audited part endpoint', () => {
    for (const status of ['UNREVIEWED', 'NEED_TO_ORDER', 'WAITING_ON_STOCK', 'IN_STOCK', 'NOT_REQUIRED']) {
      expect(layoutSource).toContain(status);
    }
    expect(layoutSource).toContain('Part material status');
    expect(layoutSource).toContain('/parts/${part.id}`');
    expect(layoutSource).toContain('JSON.stringify({ materialStatus: nextMaterialStatus })');
  });
});
