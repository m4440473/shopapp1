'use client';

export type QuotePartEntryMode = 'manual' | 'drawing' | 'existing';
type Props = { value: QuotePartEntryMode | null; onChange: (mode: QuotePartEntryMode) => void; existingDescription?: string };

export function QuotePartEntryChooser({ value, onChange, existingDescription = 'Reuse drawings and manufacturing details from this customer’s history.' }: Props) {
  return <div className="grid gap-3 md:grid-cols-3">
    <button type="button" onClick={() => onChange('drawing')} className={`rounded-xl border-2 p-5 text-left transition ${value === 'drawing' ? 'border-[#ff5a00] bg-[#ff5a00]/10' : 'border-border/60 hover:border-[#ff5a00]/70'}`}><span className="block text-lg font-semibold">Read drawings for me</span><span className="mt-1 block text-sm text-muted-foreground">Upload one drawing or a ZIP and confirm only highlighted details.</span></button>
    <button type="button" onClick={() => onChange('manual')} className={`rounded-xl border-2 p-5 text-left transition ${value === 'manual' ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white' : 'border-border/60 hover:border-[#0b1f3a]'}`}><span className="block text-lg font-semibold">Type parts myself</span><span className={`mt-1 block text-sm ${value === 'manual' ? 'text-white/75' : 'text-muted-foreground'}`}>Use the familiar manual part form.</span></button>
    <button type="button" onClick={() => onChange('existing')} className={`rounded-xl border-2 p-5 text-left transition ${value === 'existing' ? 'border-sky-400 bg-sky-400/10' : 'border-border/60 hover:border-sky-400/70'}`}><span className="block text-lg font-semibold">Choose a preexisting part</span><span className="mt-1 block text-sm text-muted-foreground">{existingDescription}</span></button>
  </div>;
}
