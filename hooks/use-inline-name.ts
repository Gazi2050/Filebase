import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export function useInlineName(
  initialValue: string,
  onConfirm: (name: string) => void,
  onCancel: () => void
) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const dot = initialValue.lastIndexOf(".");
    if (dot > 0 && inputRef.current) {
      inputRef.current.setSelectionRange(0, dot);
    } else {
      inputRef.current?.select();
    }
  }, [initialValue]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onConfirm(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (value.trim()) onConfirm(value);
    else onCancel();
  };

  return { value, setValue, inputRef, handleKeyDown, handleBlur };
}
