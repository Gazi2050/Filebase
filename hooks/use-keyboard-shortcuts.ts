import { useEffect } from "react";

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
      const key = e.key.toLowerCase();

      // Inside the rich-text editor the editor owns its shortcuts
      // (Mod+K link, Mod+B bold, ...) — only save stays app-level.
      const target = e.target as HTMLElement | null;
      if (key !== "s" && target?.closest?.(".ProseMirror")) return;

      switch (key) {
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
