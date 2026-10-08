import type { LookupContext, ToolResult } from './assistant.types';

// Deliberately narrow direct routes. Other questions retain normal model/tool conversation.
export function directLookup(message: string, previous?: LookupContext): LookupContext | undefined {
  const text = message.trim().replace(/[’]/g, "'");
  if (/\b(delete|update|change|mark|order these|place (?:an?|the) order|email|send to)\b/i.test(text)) return;
  const material = text.match(/\b(DOM|4140|4340|1018|1020|1045|6061|7075|316|304)\b/i)?.[1];
  if (previous && /^(?:please\s+)?(?:only (?:show )?(?:the )?overdue(?: ones| orders| parts| groups)?|show (?:me )?(?:only )?(?:the )?overdue(?: ones| orders| parts| groups)?)\s*[.!?]*$/i.test(text)) {
    return { name: previous.name, args: { ...previous.args, overdue: true, ...(previous.name === 'search_shop' && { offset: 0 }) } };
  }
  if (previous?.name === 'find_procurement_groups') {
    if (/^(?:show|include) (?:me )?(?:all|everything)(?: (?:groups|orders))?(?: again)?[.!?]*$/i.test(text)) return { name: previous.name, args: {} };
    if (material && /^(?:please )?(?:only |show (?:me )?(?:only )?(?:the )?)(?:DOM|4140|4340|1018|1020|1045|6061|7075|316|304)(?: (?:tube|tubing|stock|material))?(?: groups| ones| orders| parts)?[.!?]*$/i.test(text)) return { name: previous.name, args: { ...previous.args, material } };
  }
  const groupIntent = /\b(similar|same|compatible|combin\w*|group\w*|bulk)\b/i.test(text) && /\b(stock|materials?|purchas\w*)\b/i.test(text) && /\b(orders?|parts?|purchas\w*|buy\w*|supplier)\b/i.test(text);
  if (groupIntent) {
    // Buying "from Alro" is context. Assignment must be explicit before it limits results.
    const vendor = text.match(/\b(?:assigned to|already (?:assigned to|ordered from)|vendor\s*[:=])\s+([\w &.'-]+?)(?=\s+(?:across|for|with|that|and|only)\b|[?.!,]|$)/i)?.[1]?.trim();
    const customer = text.match(/\bcustomer\s*[:=]\s*([\w &.'-]+?)(?=\s+(?:across|for|with|that|and|only)\b|[?.!,]|$)/i)?.[1]?.trim();
    // Do not silently discard dates, dimensions, or unparsed named filters.
    if (/\b(?:20\d{2}|19\d{2})\b|\d\s*(?:inch|mm|"|″)|\b(?:for customer|only from|only for|waiting|in stock|completed|closed|already ordered)\b/i.test(text)) return;
    return { name: 'find_procurement_groups', args: { ...(material && { material }), ...(vendor && { vendor }), ...(customer && { customer }), ...(/\boverdue\b/i.test(text) && { overdue: true }) } };
  }
  if (/\bquotes?\b/i.test(text) && /\bcustomers?\b/i.test(text) && /\b(how many|count|number of)\b/i.test(text) && /(?:haven't|not|unconverted|never|haven.t).*(?:convert|order)|unconverted/i.test(text) && !/\b(for|from|since|before|after|during)\b/i.test(text)) {
    return { name: 'search_shop', args: { mode: 'quotes', conversion: /\bnever (?:placed |had )?(?:an? )?orders?\b/i.test(text) ? 'never_ordered' : 'unconverted' } };
  }
  if (/\b(find|show|locate)\b/i.test(text) && /\b(drawings?|files?|prints?)\b/i.test(text)) {
    const partNumber = text.match(/\bpart(?: number| no\.?)?\s+([a-z][a-z0-9_-]*\d[a-z0-9_-]*|\d+[a-z][a-z0-9_-]*)\b/i)?.[1];
    if (partNumber && !/\b(customer|from|before|after|only|latest|revision)\b/i.test(text)) return { name: 'search_shop', args: { mode: 'files', partNumber } };
  }
  if (/^(?:please )?(?:which |show (?:me )?(?:all )?(?:the )?|list (?:all )?(?:the )?|what )orders? (?:do (?:I|we) )?(?:that )?(?:need|are needing)(?: parts?| materials?| stock| or)* (?:ordered|ordering|to (?:be )?order(?:ed)?)[.!?]*$/i.test(text)) return { name: 'search_shop', args: { mode: 'procurement' } };
  if (material && /\b(find|show)\b/i.test(text) && /\b(hardened|heat treated)\b/i.test(text) && !/\b(customer|for|from|since|before|after|during)\b|\b(?:19|20)\d{2}\b/i.test(text)) {
    return { name: 'search_shop', args: { mode: 'orders', material, finish: /hardened/i.test(text) ? 'harden' : 'heat' } };
  }
}

export function lookupAnswer(result: ToolResult): string {
  if (result.procurement) return result.summary;
  const labels = result.sources.slice(0, 5).map(s => `• ${s.label}`).join('\n');
  return `${result.summary}${labels ? `\n\n${labels}` : ''}${result.sources.length > 5 ? '\n\nMore matches are in the results below.' : ''}`;
}

export function compactResult(result: ToolResult): string {
  if (result.procurement) {
    const p = result.procurement;
    return JSON.stringify({ summary: result.summary, groups: p.groups.slice(0, 6).map(g => ({ id: g.id, material: g.material, stock: g.stock, status: g.status, orderCount: g.orderCount, partCount: g.partCount, totalFinishedLength: g.totalFinishedLength, totalCutLength: g.totalCutLength, lengthNote: g.lengthNote, reasons: g.reasons })), shownGroups: Math.min(p.groups.length, 6), totalGroups: p.groups.length });
  }
  // Separate the model's evidence from the complete UI records. A document read is intentionally text-bearing.
  const document = result.rows.some(r => typeof r.text === 'string');
  const fields = document ? ['id', 'label', 'text', 'state', 'nextOffset'] : ['id', 'order', 'partNumber', 'partQuantity', 'material', 'finish', 'customer', 'quote', 'convertedOrder', 'label', 'reference', 'state', 'snippet'];
  const rows = result.rows.slice(0, document ? 1 : 5).map(row => Object.fromEntries(fields.filter(k => row[k] !== undefined).map(k => [k, typeof row[k] === 'string' ? row[k].slice(0, k === 'text' ? 12000 : 180) : row[k]])));
  return JSON.stringify({ summary: result.summary, total: result.total, offset: result.offset, modelRowsShown: rows.length, rows, note: 'UI has full result details. This is a summary subset, not all records.' });
}
