import { useEffect } from "react";

/**
 * Wires up Ctrl/Cmd+K (command palette), Ctrl/Cmd+S (save), Ctrl/Cmd+B
 * (sidebar) on the window. Each callback is expected to be stable
 * (e.g. wrapped in useCallback or sourced from a Zustand store).
 */
export function useKeyboardShortcuts({
  onSearch,
  onSave,
  onToggleSidebar,
  canSave,
}: {
  onSearch: () => void;
  onSave: () => void;
  onToggleSidebar: () => void;
  canSave: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      switch (e.key.toLowerCase()) {
        case "k":
          e.preventDefault();
          onSearch();
          break;
        case "s":
          if (canSave) {
            e.preventDefault();
            onSave();
          }
          break;
        case "b":
          e.preventDefault();
          onToggleSidebar();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearch, onSave, onToggleSidebar, canSave]);
}
