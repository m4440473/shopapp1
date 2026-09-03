import { format } from 'date-fns';

import type {
  OrderTraveler,
  OrderTravelerFile,
  OrderTravelerPart,
} from '@/modules/orders/order-traveler';

function formatDate(input: string | Date | null, withTime = false) {
  if (!input) return '—';
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) return '—';
  return format(value, withTime ? 'M/d/yy h:mm a' : 'M/d/yy');
}

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function Field({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 border-r border-b border-black p-1.5 last:border-r-0 ${className}`}>
      <div className="text-[7.5pt] font-bold uppercase tracking-wide text-zinc-600">{label}</div>
      <div className="mt-0.5 break-words text-[10pt] font-semibold leading-tight">{value || '—'}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-black bg-zinc-200 px-2 py-1 text-[8pt] font-extrabold uppercase tracking-[0.12em]">
      {children}
    </div>
  );
}

function FileList({ files, emptyText }: { files: OrderTravelerFile[]; emptyText: string }) {
  if (!files.length) return <span className="text-zinc-500">{emptyText}</span>;
  return (
    <ul className="space-y-0.5">
      {files.map((file) => (
        <li key={file.id} className="break-all">
          {file.href ? (
            <a href={file.href} className="font-semibold underline print:no-underline">
              {file.label}
            </a>
          ) : (
            <span className="font-semibold">{file.label}</span>
          )}
          {file.kind ? <span className="text-zinc-500"> · {file.kind}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function PartTraveler({
  order,
  part,
  partIndex,
  partCount,
  companyName,
}: {
  order: OrderTraveler;
  part: OrderTravelerPart;
  partIndex: number;
  partCount: number;
  companyName: string;
}) {
  const customerContact = [
    order.customer.contact,
    order.customer.phone,
    order.customer.email,
    order.customer.address,
  ].filter(Boolean).join(' · ');
  const printedAt = new Date();

  return (
    <article className="order-traveler-sheet bg-white text-black">
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <div className="text-[8pt] font-bold uppercase tracking-[0.18em] text-zinc-600">{companyName}</div>
          <h1 className="text-[20pt] font-black uppercase leading-none tracking-tight">Order Traveler</h1>
          <div className="mt-1 text-[8pt] text-zinc-600">Keep this sheet with the part through every department.</div>
        </div>
        <div className="text-right">
          <div className="text-[16pt] font-black leading-none">#{order.orderNumber}</div>
          <div className="mt-1 text-[8pt] font-semibold uppercase">Part {partIndex + 1} of {partCount}</div>
          <div className="text-[7.5pt] text-zinc-500">Printed {formatDate(printedAt, true)}</div>
        </div>
      </div>

      <section className="mt-2 border border-black">
        <div className="grid grid-cols-5">
          <Field label="Customer" value={order.customer.name} className="col-span-2" />
          <Field label="P.O. Number" value={order.poNumber} />
          <Field label="Order status" value={humanize(order.status)} />
          <Field label="Priority" value={humanize(order.priority)} />
          <Field label="Customer contact" value={customerContact || '—'} className="col-span-3 border-b-0" />
          <Field label="Received" value={formatDate(order.receivedDate)} className="border-b-0" />
          <Field label="Due" value={formatDate(order.dueDate)} className="border-b-0" />
        </div>
      </section>

      <section className="mt-2 border border-black">
        <SectionTitle>Part identification</SectionTitle>
        <div className="grid grid-cols-6">
          <Field
            label="Part number / name"
            value={part.partName ? `${part.partNumber} — ${part.partName}` : part.partNumber}
            className="col-span-3"
          />
          <Field label="Quantity" value={part.quantity} />
          <Field label="Part status" value={humanize(part.status)} />
          <Field label="Current department" value={part.currentDepartment} />
          <Field label="Material / specification" value={part.material} className="col-span-3 border-b-0" />
          <Field label="Coordinator" value={order.coordinator} className="border-b-0" />
          <Field
            label="Assigned worker(s)"
            value={part.assignedWorkers.length ? part.assignedWorkers.join(', ') : 'Unassigned'}
            className="col-span-2 border-b-0"
          />
        </div>
      </section>

      <section className="mt-2 border border-black">
        <SectionTitle>Part specifications</SectionTitle>
        <div className="grid grid-cols-2 text-[9pt]">
          {part.specifications.length ? (
            part.specifications.map((specification) => (
              <div key={specification.label} className="border-r border-b border-black px-2 py-1 last:border-r-0">
                <span className="font-bold">{specification.label}:</span> {specification.value}
              </div>
            ))
          ) : (
            <div className="col-span-2 px-2 py-1.5 text-zinc-500">No additional specifications entered.</div>
          )}
        </div>
      </section>

      <section className="mt-2 break-inside-avoid border-2 border-black">
        <div className="border-b-2 border-black bg-zinc-800 px-2 py-1 text-[8pt] font-extrabold uppercase tracking-[0.12em] text-white print:bg-black print:text-white">
          Read Me First — Required Work Instructions
        </div>
        <div className="min-h-[0.55in] whitespace-pre-wrap px-2 py-2 text-[9pt] leading-snug">
          {part.requiredReading ?? 'No required-reading instructions entered for this part.'}
        </div>
        <div className="grid grid-cols-[1fr,1.15in,1.15in] border-t border-black text-[8pt]">
          <div className="px-2 py-1.5 font-bold">Employee acknowledgement</div>
          <div className="border-l border-black px-2 py-1.5">Initials:</div>
          <div className="border-l border-black px-2 py-1.5">Date:</div>
        </div>
      </section>

      <section className="mt-2 border border-black">
        <SectionTitle>Production route &amp; checklist</SectionTitle>
        <table className="w-full table-fixed border-collapse text-[8.5pt] leading-tight">
          <thead>
            <tr className="border-b border-black text-left text-[7.5pt] uppercase text-zinc-600">
              <th className="w-[18%] border-r border-black px-2 py-1">Department</th>
              <th className="border-r border-black px-2 py-1">Operation / checkpoint</th>
              <th className="w-[10%] border-r border-black px-2 py-1 text-center">Done</th>
              <th className="w-[15%] border-r border-black px-2 py-1">Date</th>
              <th className="w-[15%] px-2 py-1">Initials</th>
            </tr>
          </thead>
          <tbody>
            {part.steps.length ? (
              part.steps.map((step) => (
                <tr key={step.id} className="border-b border-black last:border-b-0">
                  <td className="border-r border-black px-2 py-1.5 font-bold">{step.department}</td>
                  <td className="border-r border-black px-2 py-1.5">{step.label}</td>
                  <td className="border-r border-black px-2 py-1.5 text-center text-[12pt] leading-none">
                    {step.completed ? '☑' : '☐'}
                  </td>
                  <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                  <td className="px-2 py-1.5">&nbsp;</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border-r border-black px-2 py-2 font-bold">Unassigned</td>
                <td className="border-r border-black px-2 py-2 text-zinc-500">No production steps configured.</td>
                <td className="border-r border-black px-2 py-2 text-center text-[12pt]">☐</td>
                <td className="border-r border-black px-2 py-2">&nbsp;</td>
                <td className="px-2 py-2">&nbsp;</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <section className="break-inside-avoid border border-black">
          <SectionTitle>Notes</SectionTitle>
          <div className="min-h-[0.7in] whitespace-pre-wrap p-2 text-[8pt] leading-snug">
            {part.notes ? <p><strong>Part:</strong> {part.notes}</p> : null}
            {order.orderNotes.map((note) => (
              <p key={note.id} className="mt-1 first:mt-0">
                <strong>{formatDate(note.createdAt)} · {note.author}:</strong> {note.content}
              </p>
            ))}
            {!part.notes && !order.orderNotes.length ? <span className="text-zinc-500">No notes entered.</span> : null}
          </div>
        </section>
        <section className="break-inside-avoid border border-black">
          <SectionTitle>Referenced files</SectionTitle>
          <div className="min-h-[0.7in] p-2 text-[8pt] leading-snug">
            <div className="font-bold">Part files</div>
            <FileList files={part.files} emptyText="None attached" />
            <div className="mt-1.5 font-bold">Order files</div>
            <FileList files={order.orderFiles} emptyText="None attached" />
          </div>
        </section>
      </div>

      <section className="mt-2 break-inside-avoid border border-black">
        <SectionTitle>Final inspection / release</SectionTitle>
        <div className="grid grid-cols-[1fr,1fr,1fr] text-[8pt]">
          <div className="min-h-[0.52in] border-r border-black px-2 py-1.5"><strong>Final quantity:</strong></div>
          <div className="border-r border-black px-2 py-1.5"><strong>Inspected by:</strong></div>
          <div className="px-2 py-1.5"><strong>Date:</strong></div>
        </div>
      </section>
    </article>
  );
}

export function OrderTravelerDocument({ traveler, companyName }: { traveler: OrderTraveler; companyName: string }) {
  const printableParts = traveler.parts.length
    ? traveler.parts
    : [{
        id: 'unassigned-part',
        partNumber: 'No part entered',
        partName: null,
        quantity: 0,
        status: traveler.status,
        currentDepartment: 'Unassigned',
        assignedWorkers: [],
        material: 'Not specified',
        specifications: [],
        requiredReading: null,
        notes: null,
        files: [],
        steps: [],
      }];

  return (
    <div className="order-traveler-root">
      <style>{`
        @page { size: letter portrait; margin: 0.35in; }
        .order-traveler-sheet {
          box-sizing: border-box;
          margin: 0 auto 24px;
          min-height: 10.3in;
          max-width: 7.8in;
          padding: 0.08in;
          box-shadow: 0 12px 36px rgba(0,0,0,.18);
        }
        .order-traveler-sheet + .order-traveler-sheet { break-before: page; }
        @media print {
          body * { visibility: hidden; }
          .order-traveler-root, .order-traveler-root * { visibility: visible; }
          .order-traveler-root { position: absolute; inset: 0; width: 100%; }
          .order-traveler-sheet {
            min-height: 10.25in;
            max-width: none;
            margin: 0;
            padding: 0;
            box-shadow: none;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      {printableParts.map((part, index) => (
        <PartTraveler
          key={part.id}
          order={traveler}
          part={part}
          partIndex={index}
          partCount={printableParts.length}
          companyName={companyName}
        />
      ))}
    </div>
  );
}
