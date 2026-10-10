import * as React from "react";
import { useCallback, useState } from "react";

export interface DropdownPillHandlers {
  onFocus: (event: React.FocusEvent<HTMLDivElement>) => void;
  onMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseOver: (event: React.MouseEvent<HTMLDivElement>) => void;
}

interface PillRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

const useDropdownPill = (
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void
): { handlers: DropdownPillHandlers; pill: React.ReactNode } => {
  const [rect, setRect] = useState<PillRect | null>(null);

  const handleItemEnter = useCallback(
    (target: EventTarget | null, scope?: EventTarget | null) => {
      const item = (target as HTMLElement).closest<HTMLElement>(
        "[data-dropdown-item]"
      );
      if (!item) {
        return;
      }
      // Portal menus (context/dropdown popups) bubble React events up to
      // ancestor pills — e.g. a file context menu to the file-tree pill.
      // Only track items actually contained in this pill's own wrapper.
      const scopeEl = scope as HTMLElement | null;
      if (scopeEl && !scopeEl.contains(item)) {
        return;
      }
      // Selected/checked items paint their own distinction — keep the hover
      // pill off them so the two states never overlap (sidebar selected row,
      // checked radio options). Clearing here (not just hiding in CSS) means
      // mouse and keyboard focus both behave the same and no stale rect
      // survives a selection change. (Base UI marks checked with the
      // `data-checked` presence attribute; `data-state` is covered too.)
      // Destructive items paint their own red hover/focus distinction — keep
      // the hover pill off them so it never washes out the warning state.
      if (
        item.hasAttribute("data-selected") ||
        item.hasAttribute("data-checked") ||
        item.dataset.state === "checked" ||
        item.dataset.variant === "destructive"
      ) {
        setRect(null);
        return;
      }
      setRect({
        height: item.offsetHeight,
        left: item.offsetLeft,
        top: item.offsetTop,
        width: item.offsetWidth,
      });
    },
    []
  );

  const handlers: DropdownPillHandlers = {
    onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
      handleItemEnter(event.target, event.currentTarget);
    },
    onMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => {
      setRect(null);
      onMouseLeave?.(event);
    },
    onMouseOver: (event: React.MouseEvent<HTMLDivElement>) => {
      handleItemEnter(event.target, event.currentTarget);
    },
  };

  const pill = (
    <div
      aria-hidden="true"
      className={["ext-dropdown-pill", rect ? "ext-dropdown-pill--visible" : ""]
        .filter(Boolean)
        .join(" ")}
      style={
        rect
          ? {
              height: rect.height,
              left: rect.left,
              top: rect.top,
              width: rect.width,
            }
          : undefined
      }
    />
  );

  return { handlers, pill };
};

export { useDropdownPill };
