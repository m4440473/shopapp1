"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva("flex h-10 w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2", {
  variants: {
    variant: {
      default: "bg-[#0f1418] border-[1px] border-[#1f2933] text-[#E6EDF3]",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {}

export default function Input({ className, ...props }: InputProps) {
  return <input className={cn(inputVariants(), className)} {...props} />;
}
