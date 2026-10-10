"use client";

import { useDropdownPill } from "@/components/extensions/ui/dropdown-pill";
import { cn } from "@/lib/utils";

/**
 * Wraps the items of a shadcn dropdown/context menu so a single highlight
 * pill glides between items (220ms transition) instead of snapping per
 * item — the same hover feel as the editorcn table menus.
 *
 * Each item inside must carry `data-dropdown-item` (presence attribute);
 * instant per-item backgrounds are neutralized by the `.menu-pill` rule in
 * globals.css, so only the pill paints the hover state.
 */
export function MenuPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { handlers, pill } = useDropdownPill();
  return (
    <div className={cn("menu-pill relative", className)} {...handlers}>
      {pill}
      {children}
    </div>
  );
}
