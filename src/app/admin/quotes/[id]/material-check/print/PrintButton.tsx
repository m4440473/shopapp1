'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white print:hidden"
    >
      Print this sheet
    </button>
  );
}
