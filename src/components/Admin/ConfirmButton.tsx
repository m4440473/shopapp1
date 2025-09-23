"use client";
import React from 'react';

export default function ConfirmButton({ onConfirm, children }: any) {
  return (
    <button onClick={() => { if (confirm('Are you sure?')) onConfirm(); }} className="px-2 py-1 rounded border text-sm">
      {children}
    </button>
  );
}
