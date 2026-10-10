import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const defaultEqual = <T>(a: T, b: T) => a === b;

export const shallowEqual = <T extends Record<string, unknown>>(
  a: T,
  b: T
): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) {
    return false;
  }
  return ak.every((k) => a[k] === b[k]);
};

export const useEditorState = <T>(
  editor: Editor | null,
  selector: (e: Editor) => T,
  isEqual: (a: T, b: T) => boolean = defaultEqual
): T => {
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);

  useEffect(() => {
    selectorRef.current = selector;
    isEqualRef.current = isEqual;
  });

  const snapshotRef = useRef<{ value: T }>({
    value: editor ? selector(editor) : (undefined as unknown as T),
  });

  const updateSnapshot = useCallback(() => {
    if (!editor) {
      return;
    }
    const next = selectorRef.current(editor);
    if (
      snapshotRef.current &&
      isEqualRef.current(snapshotRef.current.value, next)
    ) {
      return;
    }
    snapshotRef.current = { value: next };
  }, [editor]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!editor) {
        return () => {
          // noop
        };
      }
      const update = () => {
        updateSnapshot();
        onStoreChange();
      };
      editor.on("selectionUpdate", update);
      editor.on("transaction", update);
      return () => {
        editor.off("selectionUpdate", update);
        editor.off("transaction", update);
      };
    },
    [editor, updateSnapshot]
  );

  const getSnapshot = useCallback((): T => snapshotRef.current.value, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const copyBlock = async (editor: Editor): Promise<void> => {
  const { from } = editor.state.selection;
  const $from = editor.state.doc.resolve(from);
  const start = $from.before($from.depth);
  const end = $from.after($from.depth);
  if (start < 0 || end <= start) {
    return;
  }
  const text = editor.state.doc.textBetween(start, end, "\n", "\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignored */
  }
};

export const deleteBlock = (editor: Editor): void => {
  const { from } = editor.state.selection;
  const $from = editor.state.doc.resolve(from);
  const { depth } = $from;
  const start = $from.before(depth);
  const end = $from.after(depth);
  if (start < 0 || end <= start) {
    return;
  }
  editor.chain().focus().deleteRange({ from: start, to: end }).run();
};

export const CODE_BLOCK_LANGUAGES = [
  "javascript",
  "typescript",
  "html",
  "css",
  "json",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "sql",
  "bash",
  "markdown",
  "yaml",
  "xml",
  "plaintext",
] as const;

export const CODE_BLOCK_LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  css: "CSS",
  go: "Go",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  json: "JSON",
  kotlin: "Kotlin",
  markdown: "Markdown",
  php: "PHP",
  plaintext: "Plain Text",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  sql: "SQL",
  swift: "Swift",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
};

export const getLanguageLabel = (lang: string): string =>
  CODE_BLOCK_LANGUAGE_LABELS[lang] ?? lang;

// Per-language icon tint from the Catppuccin Mocha palette, following the
// vscode-icons pack (one recognizable color per language; duplicates are
// fine since the glyph shapes differ).
export const LANGUAGE_ICON_COLORS: Record<string, string> = {
  bash: "#a6e3a1",
  c: "#74c7ec",
  cpp: "#f5c2e7",
  css: "#89dceb",
  go: "#94e2d5",
  html: "#fab387",
  java: "#eba0ac",
  javascript: "#f9e2af",
  json: "#f2cdcd",
  kotlin: "#cba6f7",
  markdown: "#cdd6f4",
  php: "#b4befe",
  plaintext: "#a6adc8",
  python: "#89b4fa",
  ruby: "#f38ba8",
  rust: "#fab387",
  sql: "#94e2d5",
  swift: "#fab387",
  typescript: "#89b4fa",
  xml: "#89dceb",
  yaml: "#f38ba8",
};
