'use client';

import { AlertTriangle, ChevronRight, PackageSearch } from 'lucide-react';
import type { ProcurementGroup, ProcurementGroupingResult } from '@/modules/procurement';

const inches = (value: number | null) => value === null ? 'Incomplete' : `${Number(value.toFixed(3))} in`;
const safeOrderHref = (href: string) => /^\/orders\/[^/?#]+(?:\?part=[^&#]+)?$/.test(href) && !href.startsWith('//') ? href : null;

function GroupCard({ group }: { group: ProcurementGroup }) {
  return <details className="group rounded-xl border border-border bg-background/50 open:bg-background/70">
    <summary style={{ display: 'block', listStyle: 'none' }} className="cursor-pointer list-none px-3 py-3 sm:px-4 [&::-webkit-details-marker]:hidden">
      <div className="flex items-start gap-3"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" /><div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold">{group.material} · {group.stock}</span>{group.status === 'needs_review' && <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-300">Needs review</span>}</div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground sm:grid-cols-4">
          <span><strong className="block text-foreground">{group.orderCount}</strong>{group.orderCount === 1 ? 'order' : 'orders'}</span>
          <span><strong className="block text-foreground">{group.partCount}</strong>{group.partCount === 1 ? 'part line' : 'part lines'} · {group.quantity} pieces</span>
          <span><strong className="block text-foreground">{inches(group.totalFinishedLength)}</strong>finished length</span>
          <span><strong className="block text-foreground">{inches(group.totalCutLength)}</strong>recorded cut length</span>
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">{group.reasons.map(reason => <p key={reason} className="text-amber-300">Review: {reason}</p>)}{group.lengthNote && <p>Allowance: {group.lengthNote}</p>}</div>
      </div></div>
    </summary>
    <div className="space-y-2 border-t border-border/70 px-3 py-3 sm:px-4">{group.members.map(member => {
      const href = safeOrderHref(member.href);
      return <div key={member.id} className="rounded-lg border border-border/60 p-3 text-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><div className="min-w-0"><span className="font-semibold text-foreground">{href ? <a className="text-primary underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">Order {member.orderNumber}</a> : `Order ${member.orderNumber}`}</span><span className="mx-1.5 text-muted-foreground">·</span><span className="break-words">{member.partNumber}{member.partName ? ` — ${member.partName}` : ''}</span></div><span className="text-muted-foreground">Qty {member.quantity}</span></div>
        <p className="mt-1 text-muted-foreground">{member.customerName || 'Customer not recorded'} · due {member.dueDate.slice(0, 10)}{member.vendorName ? ` · vendor ${member.vendorName}` : ''}</p>
        <p className="mt-2 break-words text-muted-foreground">Recorded material: {member.materialRaw || 'Not recorded'} · recorded stock: {member.stockSize || 'Not recorded'}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-5"><div><dt>Finished each</dt><dd className="font-medium text-foreground">{member.finalPartLength || 'Not recorded'}</dd></div><div><dt>Cut each</dt><dd className="font-medium text-foreground">{member.cutLength || 'Not recorded'}</dd></div><div><dt>Finished total</dt><dd className="font-medium text-foreground">{inches(member.totalFinishedLength)}</dd></div><div><dt>Total needed</dt><dd className="font-medium text-foreground">{inches(member.totalCutLength)}</dd></div></dl>
        {member.lengthNote && <p className="mt-2 break-words text-muted-foreground">Allowance: {member.lengthNote}</p>}{member.reasons.map(reason => <p key={reason} className="mt-1 break-words text-amber-300">Review: {reason}</p>)}{member.normalized.evidence.map(item => <p key={item} className="mt-1 break-words text-muted-foreground">Evidence: {item}</p>)}
      </div>;
    })}</div>
  </details>;
}

export function ProcurementResults({ report }: { report: ProcurementGroupingResult }) {
  const confirmed = report.groups.filter(group => group.status === 'compatible');
  const needsReview = report.groups.filter(group => group.status === 'needs_review');
  return <section aria-label="Purchasing groups" className="space-y-3">
    <div><div className="flex items-center gap-2 text-sm font-semibold"><PackageSearch className="h-4 w-4 text-primary" />Purchasing groups</div><p className="mt-1 text-xs text-muted-foreground">{report.eligibleParts} eligible part lines across {report.eligibleOrders} orders</p></div>
    {confirmed.length ? <div className="space-y-2">{confirmed.map(group => <GroupCard key={group.id} group={group} />)}</div> : <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">No confirmed cross-order stock groups were found. Parts with incomplete or ambiguous details appear under review.</div>}
    {(needsReview.length > 0 || report.unreviewedParts > 0) && <details open={!confirmed.length} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><summary className="cursor-pointer text-sm font-medium text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4" />Needs review ({needsReview.length} possible groups{report.unreviewedParts ? ` · ${report.unreviewedParts} unreviewed parts` : ''})</summary><div className="mt-3 space-y-2">{needsReview.map(group => <GroupCard key={group.id} group={group} />)}{!needsReview.length && <p className="text-xs text-muted-foreground">These parts are not confirmed purchases yet.</p>}</div></details>}
    {report.ungrouped.length > 0 && <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Ungrouped or missing details ({report.ungrouped.length})</summary><div className="mt-3 space-y-2">{report.ungrouped.map(part => <div key={part.id} className="rounded-lg border border-border/60 p-3 text-xs"><p className="font-medium text-foreground">Order {part.orderNumber} · {part.partNumber}</p><p className="mt-1 text-muted-foreground">{part.reason}</p></div>)}</div></details>}
  </section>;
}
