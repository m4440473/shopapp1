import type { WorkItemRateType } from '@/modules/pricing/work-item-pricing';
import { extractIntakeError } from './order-intake.client';

type Addon = { id?: string; name?: string; description?: string | null; rateType?: WorkItemRateType; rateCents?: number; affectsPrice?: boolean; isChecklistItem?: boolean; department?: { id?: string; name?: string } | null };
type Selection = { quotePartId?: string | null; addonId?: string; units?: number; notes?: string | null; rateCents?: number; affectsPrice?: boolean; isChecklistItem?: boolean; addon?: Addon | null };
type Part = { id?: string; name?: string | null; partNumber?: string | null; quantity?: number; pieceCount?: number; materialId?: string | null; drawingMaterialText?: string | null; drawingFinishText?: string | null; finish?: string | null; stockSize?: string | null; cutLength?: string | null; finalPartLength?: string | null; partWidth?: string | null; partThickness?: string | null; description?: string | null; notes?: string | null; workInstructions?: string | null; addonSelections?: Selection[] };
export type OrderPrefillQuote = { quoteNumber?: string; business: string; customer?: { id?: string } | null; customerContactId?: string | null; multiPiece?: boolean; dueDate?: string | null; materialSummary?: string | null; purchaseItems?: string | null; requirements?: string | null; notes?: string | null; parts?: Part[]; addonSelections?: Selection[] };

const partNotes = (part: Part) => [part.description?.trim(), (part.pieceCount ?? 1) > 1 ? `Pieces: ${part.pieceCount}` : '', part.stockSize ? `Total stock dimensions: ${part.stockSize}` : '', part.cutLength ? `Cut length: ${part.cutLength}` : '', part.notes?.trim()].filter(Boolean).join('\n').trim();
const bullet = (heading: string, value: unknown) => { const lines = String(value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean); return lines.length ? `${heading}:\n${lines.map((line) => `- ${line}`).join('\n')}` : ''; };
const instructions = (quote: OrderPrefillQuote, part: Part) => [bullet('Required reading', part.workInstructions), bullet('Quote requirements', quote.requirements), bullet('Quote notes', quote.notes), bullet('Materials', quote.materialSummary), bullet('Purchase items', quote.purchaseItems), bullet('Part-specific notes', part.notes)].filter(Boolean).join('\n\n').trim();

export async function loadQuoteForOrder(quoteId: string, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<OrderPrefillQuote> {
  const response = await fetchImpl(`/api/admin/quotes/${encodeURIComponent(quoteId)}`, { credentials: 'include', signal });
  if (!response.ok) throw new Error(await extractIntakeError(response, 'Quote could not be loaded.'));
  const data = await response.json();
  if (!data?.item) throw new Error('Quote not found');
  return data.item as OrderPrefillQuote;
}

export function mapQuoteToOrderPrefill(quote: OrderPrefillQuote, keyFactory: () => string, now = new Date()) {
  const legacy = (quote.addonSelections ?? []).filter((selection) => !selection.quotePartId);
  const parts = (quote.parts ?? []).map((part, index) => {
    const selections = part.addonSelections?.length ? part.addonSelections : index === 0 ? legacy : [];
    return { key: keyFactory(), sourceQuotePartId: part.id, partNumber: part.partNumber ?? part.name ?? '', partName: part.name ?? '', quantity: String(part.quantity ?? 1), materialId: part.materialId ?? '', drawingMaterialText: part.drawingMaterialText ?? '', drawingFinishText: part.drawingFinishText ?? '', finish: part.finish ?? '', stockSize: part.stockSize ?? '', cutLength: part.cutLength ?? '', finalPartLength: part.finalPartLength ?? '', partWidth: part.partWidth ?? '', partThickness: part.partThickness ?? '', notes: partNotes(part), workInstructions: instructions(quote, part), addonSelections: selections.map((selection) => ({ key: keyFactory(), addonId: selection.addonId ?? selection.addon?.id ?? '', units: String(selection.units ?? 1), notes: selection.notes ?? '' })), attachments: [] as Array<{ kind: 'DWG' | 'STEP' | 'PRINT' | 'PDF' | 'IMAGE'; storagePath: string; label: string; mimeType: string }> };
  });
  const addonIds = new Set<string>();
  const snapshots = new Map<string, { id: string; name: string; description?: string | null; rateType?: WorkItemRateType; rateCents?: number; active: boolean; affectsPrice: boolean; isChecklistItem: boolean; department: { id: string; name: string } | null }>();
  for (const selection of [...(quote.parts ?? []).flatMap((part) => part.addonSelections ?? []), ...(quote.addonSelections ?? [])]) {
    const id = selection.addon?.id ?? selection.addonId;
    if (!id) continue;
    addonIds.add(id);
    if (selection.addon) snapshots.set(id, { id, name: selection.addon.name ?? 'Unnamed add-on', description: selection.addon.description ?? null, rateType: selection.addon.rateType, rateCents: typeof selection.addon.rateCents === 'number' ? selection.addon.rateCents : selection.rateCents, active: true, affectsPrice: typeof selection.addon.affectsPrice === 'boolean' ? selection.addon.affectsPrice : selection.affectsPrice ?? true, isChecklistItem: typeof selection.addon.isChecklistItem === 'boolean' ? selection.addon.isChecklistItem : selection.isChecklistItem ?? false, department: selection.addon.department?.id ? { id: selection.addon.department.id, name: selection.addon.department.name ?? 'Department' } : null });
  }
  const notes = [`Converted from quote ${quote.quoteNumber} on ${now.toLocaleString()}.`, quote.materialSummary ? `Materials:\n${quote.materialSummary}` : '', quote.purchaseItems ? `Purchase items:\n${quote.purchaseItems}` : '', quote.requirements ? `Requirements:\n${quote.requirements}` : '', quote.notes ? `Quote notes:\n${quote.notes}` : ''].filter(Boolean).join('\n\n').trim();
  return { business: quote.business, customerId: quote.customer?.id ?? '', customerContactId: quote.customerContactId ?? '', modelIncluded: Boolean(quote.multiPiece), parts, selectedAddonIds: [...addonIds], addonSnapshots: [...snapshots.values()], dueDate: quote.dueDate?.slice(0, 10) ?? '', note: notes };
}
