import { prisma } from '@/lib/prisma';
import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';

export async function generateNextOrderNumber(business: BusinessCode): Promise<string> {
  const recent = await prisma.order.findMany({
    select: { orderNumber: true },
    where: { business },
    orderBy: { orderNumber: 'desc' },
    take: 200,
  });

  let maxValue = 1000;
  for (const candidate of recent) {
    const numeric = parseInt(candidate.orderNumber.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      maxValue = Math.max(maxValue, numeric);
    }
  }

  const prefix = BUSINESS_PREFIX_BY_CODE[business] ?? business;
  return `${prefix}-${maxValue + 1}`;
}
