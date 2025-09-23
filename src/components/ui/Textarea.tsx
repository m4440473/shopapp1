"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva("w-full rounded-md border px-3 py-2 text-sm bg-[#0f1418] text-[#E6EDF3]", {
  variants: {
    size: {
      default: "min-h-[80px]",
    },
  },
  defaultVariants: { size: "default" },
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {}

export default function Textarea({ className, ...props }: TextareaProps) {
  return <textarea {...props} className={cn(textareaVariants(), className)} style={{ resize: 'none' }} />;
}
