import 'server-only';
import { searchSchema } from './assistant.schema';
import { listAssistantFiles, searchCustomers, searchOrderParts, searchQuotes } from './assistant.repo';
import { attachmentHref, readDocumentIndex, searchSnippet } from './assistant.documents';
import type { ToolResult } from './assistant.types';
import { findProcurementGroups } from '../procurement/procurement.service';
import { ProcurementGroupFiltersSchema } from '../procurement/procurement.schema';

export const assistantTools = [{ type: 'function', function: {
  name: 'search_shop',
  description: 'Read live ShopApp records or document text. Always use for shop facts/counts. Modes: orders searches PARTS across ALL history; procurement finds active parts needing ordering; quotes reports quotes and distinct linked customers; customers reports customers; files finds PDFs/images/CAD by part number, filename or indexed content. Empty query lists all. All supplied filters combine with AND. Use short keywords, not sentences. Hardened: finish="harden". Pagination is 25 rows; offset=25 for next page. Conversion unconverted=has quotes with no linked converted order; never_ordered=also customer has zero orders. For customer quote conversion questions prefer quotes mode. Counts are complete, rows paginated.',
  parameters: { type: 'object', properties: {
    mode: { type: 'string', enum: ['orders', 'procurement', 'quotes', 'customers', 'files'] },
    query: { type: 'string', description: 'Short text keywords; leave empty when using other filters' },
    customer: { type: 'string' }, material: { type: 'string' }, finish: { type: 'string' },
    orderNumber: { type: 'string' }, partNumber: { type: 'string' },
    fromYear: { type: 'integer' }, toYear: { type: 'integer' }, overdue: { type: 'boolean' }, activeOnly: { type: 'boolean' },
    materialStatus: { type: 'string', enum: ['UNREVIEWED', 'NEED_TO_ORDER', 'WAITING_ON_STOCK', 'IN_STOCK', 'NOT_REQUIRED'] },
    conversion: { type: 'string', enum: ['any', 'unconverted', 'never_ordered'] }, offset: { type: 'integer' },
  }, required: ['mode'] },
} }, { type: 'function', function: {
  name: 'read_document', description: 'Read indexed PDF/OCR/CAD text for an attachment ID from search_shop files. Returns up to 12000 characters from offset. Use to discuss a drawing or document; never claim unextracted geometry is verified.',
  parameters: { type: 'object', properties: { id: { type: 'string' }, offset: { type: 'integer' } }, required: ['id'] },
} }, { type: 'function', function: {
  name: 'find_procurement_groups',
  description: 'Find opportunities to combine stock purchases across DIFFERENT active orders needing material ordered. Deterministic complete-set grouping by material, profile and cross-section, with trustworthy lengths or explicit review reasons. Use for similar stock, same dimensions, combining orders, bulk material purchases. Supplier mentioned as buying context (Alro) is NOT a filter; vendor only if explicitly assigned to that supplier. Never use material=Alro. No purchase is placed.',
  parameters: { type: 'object', properties: { material: { type: 'string' }, overdue: { type: 'boolean' }, customer: { type: 'string' }, vendor: { type: 'string', description: 'Only for parts explicitly assigned to this vendor; omit for a planned supplier.' } } },
} }];

export async function executeAssistantTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === 'find_procurement_groups') {
    const report = await findProcurementGroups(ProcurementGroupFiltersSchema.parse(args));
    const exact = report.groups.filter(g => g.status === 'compatible').length;
    const review = report.groups.length - exact;
    const lead = report.groups.length ? `${exact} matching stock group${exact === 1 ? '' : 's'} and ${review} possible group${review === 1 ? '' : 's'} needing review across different orders.` : 'No stock groups spanning different orders were found in the selected parts.';
    const preview = report.groups.slice(0, 4).map(g => `• **${g.material} · ${g.stock}** — ${g.orderCount} orders, ${g.partCount} part lines.${g.totalCutLength !== null ? ` ${g.totalCutLength.toLocaleString('en-US', { maximumFractionDigits: 3 })} in combined recorded cut length; no extra allowance added.` : g.totalFinishedLength !== null ? ` ${g.totalFinishedLength.toLocaleString('en-US', { maximumFractionDigits: 3 })} in finished length before extra allowances.` : ' Purchase length needs review.'}${g.status === 'needs_review' ? ' Check the review notes before combining.' : ''}`).join('\n');
    const summary = `${lead}\nChecked all ${report.eligibleParts} selected parts needing purchase across ${report.eligibleOrders} orders.${report.unreviewedParts ? ` ${report.unreviewedParts} unreviewed parts are excluded.` : ''}${preview ? `\n\n${preview}` : ''}${report.groups.length > 4 ? `\n${report.groups.length - 4} more group${report.groups.length === 5 ? ' appears' : 's appear'} below.` : ''}${report.ungrouped.length ? `\n\n${report.ungrouped.length} parts have no cross-order match or need more stock information; see the separate list.` : ''}`;
    return { summary, total: report.groups.length, offset: 0, rows: [], procurement: report,
      sources: report.groups.flatMap(g => g.members.map(m => ({ id: m.id, label: `${m.orderNumber} · ${m.partNumber}`, href: m.href }))),
    };
  }
  if (name === 'read_document') {
    if (typeof args.id !== 'string' || args.id.length > 100 || (args.offset !== undefined && (!Number.isInteger(args.offset) || Number(args.offset) < 0))) throw new Error('Invalid document request.');
    const files = await listAssistantFiles();
    const file = files.find(f => f.id === args.id);
    if (!file) throw new Error('Attachment not found. Search files first.');
    const document = (await readDocumentIndex()).documents[file.storagePath || ''];
    const href = attachmentHref(file.storagePath) || file.parentHref;
    const offset = Number(args.offset || 0);
    return { summary: document ? `${document.state}; ${document.method}; ${document.text.length} characters. Extracted text, not verified geometry.` : 'Not indexed yet. Only file metadata is available.', total: 1, offset,
      rows: [{ id: file.id, label: file.label, text: document?.text.slice(offset, offset + 12000) || '', nextOffset: document && offset + 12000 < document.text.length ? offset + 12000 : null, state: document?.state, pages: document?.pages, indexedPages: document?.indexedPages }],
      sources: [{ id: file.id, label: file.label, href, detail: `${file.reference} · ${file.customer}` }],
    };
  }
  if (name !== 'search_shop') throw new Error('Unknown tool. Only read-only shop tools are available.');
  const s = searchSchema.parse(args);
  if (s.mode === 'orders' || s.mode === 'procurement') {
    const result = await searchOrderParts(s);
    const stateLabels: Record<string, string> = { NEED_TO_ORDER: 'need purchase', UNREVIEWED: 'need a material review', WAITING_ON_STOCK: 'are waiting for stock', IN_STOCK: 'have stock available', NOT_REQUIRED: 'do not require stock' };
    return { summary: `${result.total} matching part${result.total === 1 ? '' : 's'} across ${result.orderCount} order${result.orderCount === 1 ? '' : 's'}.${s.mode === 'procurement' ? ` These parts ${stateLabels[s.materialStatus || 'NEED_TO_ORDER']}. ${result.unreviewed} additional active parts have not been reviewed for purchase.` : ''}${result.total > result.rows.length ? ` Showing ${s.offset + (result.rows.length ? 1 : 0)}–${s.offset + result.rows.length} of ${result.total}.` : ''}`, total: result.total, offset: s.offset,
      rows: result.rows.map(p => ({ id: p.id, order: p.order.orderNumber, customer: p.order.customer.name, partNumber: p.partNumber, partName: p.partName, partQuantity: p.quantity, dueDate: p.order.dueDate.toISOString().slice(0, 10), receivedDate: p.order.receivedDate.toISOString().slice(0, 10), status: p.status, material: p.drawingMaterialText || p.material?.name, finish: p.drawingFinishText || p.finish, materialStatus: p.materialStatus, vendor: p.procurementVendor?.name, stockSize: p.stockSize, notes: [p.notes, p.materialNotes, p.workInstructions].filter(Boolean).join('\n').slice(0, 2000) })),
      sources: result.rows.map(p => ({ id: p.id, label: `${p.order.orderNumber} · ${p.partNumber}`, href: `/orders/${p.order.id}?part=${p.id}`, detail: `${p.order.customer.name} · ${p.materialStatus} · due ${p.order.dueDate.toISOString().slice(0, 10)}` })),
    };
  }
  if (s.mode === 'quotes') {
    const r = await searchQuotes(s);
    return { summary: `${r.total} ${s.conversion === 'any' ? 'matching' : 'unconverted'} quotes covering ${r.customerCount} distinct linked customers.${s.conversion === 'never_ordered' ? ' These customers have never placed an order.' : s.conversion === 'unconverted' ? ' They may have other orders; these quotes have no linked order.' : ''} ${r.unlinkedQuotes} quotes have no linked customer and are excluded from the customer count.`, total: r.total, offset: s.offset,
      rows: r.rows.map(q => ({ id: q.id, quote: q.quoteNumber, customer: q.customer?.name || q.companyName, status: q.status, total: q.totalCents / 100, createdAt: q.createdAt.toISOString().slice(0, 10), convertedOrder: q.convertedOrder?.orderNumber || null })),
      sources: r.rows.map(q => ({ id: q.id, label: `${q.quoteNumber} · ${q.customer?.name || q.companyName}`, href: `/admin/quotes/${q.id}` })),
    };
  }
  if (s.mode === 'customers') {
    const r = await searchCustomers(s);
    return { summary: `${r.total} matching customers. Conversion filter: ${s.conversion}.`, total: r.total, offset: s.offset,
      rows: r.rows.map(c => ({ id: c.id, customer: c.name, orders: c._count.orders, quotes: c._count.quotes })),
      sources: r.rows.map(c => ({ id: c.id, label: c.name, href: `/customers/${c.id}` })),
    };
  }
  const [files, index] = await Promise.all([listAssistantFiles(), readDocumentIndex()]);
  const terms = [s.query, s.material, s.finish].join(' ').split(/\s+/).filter(Boolean);
  const has = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());
  const normalized = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matching = files.filter(f => {
    const doc = index.documents[f.storagePath || ''];
    const searchable = [f.label, f.partNumber, f.customer, f.reference, doc?.text || ''].join(' ');
    return has(f.customer, s.customer) && has(f.reference, s.orderNumber) &&
      (!s.partNumber || normalized([f.partNumber, f.label, doc?.text || ''].join(' ')).includes(normalized(s.partNumber))) && terms.every(t => has(searchable, t));
  }).sort((a, b) => a.reference.localeCompare(b.reference) || a.id.localeCompare(b.id));
  const rows = matching.slice(s.offset, s.offset + 25);
  return { summary: `${matching.length} matching attachment records (copies may belong to different orders). Document index last updated: ${index.updatedAt || 'not yet built'}; ${index.status || 'pending'}. Search includes filenames, linked part numbers and extracted content.`, total: matching.length, offset: s.offset,
    rows: rows.map(f => { const d = index.documents[f.storagePath || '']; return { id: f.id, label: f.label, reference: f.reference, customer: f.customer, partNumber: f.partNumber, state: d?.state || 'not indexed', method: d?.method || 'metadata only', snippet: searchSnippet(d?.text || '', terms), pages: d?.pages, indexedPages: d?.indexedPages }; }),
    sources: rows.map(f => ({ id: f.id, label: `${f.label} · ${f.reference}`, href: attachmentHref(f.storagePath) || f.parentHref, detail: `${f.customer}${f.partNumber ? ` · ${f.partNumber}` : ''}` })),
  };
}
