"use client";

import { cn } from "@/lib/utils";
import { useInlineName } from "@/hooks/use-inline-name";

interface InlineNameInputProps {
  initialValue: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
  stopClickPropagation?: boolean;
}

export function InlineNameInput({
  initialValue,
  onConfirm,
  onCancel,
  placeholder,
  className,
  stopClickPropagation,
}: InlineNameInputProps) {
  const { value, setValue, inputRef, handleKeyDown, handleBlur } =
    useInlineName(initialValue, onConfirm, onCancel);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "h-6 min-w-0 rounded border border-primary/60 bg-background px-1.5 text-xs text-foreground outline-none ring-1 ring-primary/40 selection:bg-primary/20",
        className
      )}
    />
  );
}
