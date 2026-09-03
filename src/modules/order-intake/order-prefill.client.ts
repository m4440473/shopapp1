import type { RepeatOrderTemplateDetail } from '@/modules/repeat-orders/repeat-orders.types';
import { extractIntakeError } from './order-intake.client';

type FetchLike = typeof fetch;

export async function loadRepeatOrderTemplate(
  templateId: string,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<RepeatOrderTemplateDetail> {
  const response = await fetchImpl(`/api/repeat-order-templates/${encodeURIComponent(templateId)}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    throw new Error(await extractIntakeError(response, 'The repeat-order template could not be loaded.'));
  }
  const data = await response.json();
  if (!data?.template) throw new Error('Repeat-order template not found');
  return data.template as RepeatOrderTemplateDetail;
}
