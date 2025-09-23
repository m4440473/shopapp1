"use client";
import React from 'react';

export default function DialogForm({ title, children, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#121821] p-4 rounded w-full max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="px-2 py-1">Close</button>
        </div>
        <div>{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Cancel</button>
          <button onClick={onSubmit} className="px-3 py-1 rounded bg-[#34D399] text-black">Save</button>
        </div>
      </div>
    </div>
  );
}
