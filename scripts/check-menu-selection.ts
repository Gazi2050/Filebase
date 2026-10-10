import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const constants = await readFile(
  new URL(
    "../components/templates/simple-document-editor/constants.ts",
    import.meta.url
  ),
  "utf8"
);
const toolbar = await readFile(
  new URL(
    "../components/templates/simple-document-editor/toolbar.tsx",
    import.meta.url
  ),
  "utf8"
);
const codeBlock = await readFile(
  new URL(
    "../components/templates/simple-document-editor/code-block.tsx",
    import.meta.url
  ),
  "utf8"
);
const rteDropdown = await readFile(
  new URL("../components/editor/ui/rte-dropdown.tsx", import.meta.url),
  "utf8"
);
const rteDropdownItem = await readFile(
  new URL("../components/editor/ui/rte-dropdown-item.tsx", import.meta.url),
  "utf8"
);
const globalStyles = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const extensionStyles = await readFile(
  new URL("../components/extensions/ui/style.css", import.meta.url),
  "utf8"
);
const editorStyles = await readFile(
  new URL("../components/editor/style.css", import.meta.url),
  "utf8"
);
const blockEditorStyles = await readFile(
  new URL("../components/block-editor/style.css", import.meta.url),
  "utf8"
);
const blockEditorUtils = await readFile(
  new URL("../components/block-editor/bubble-menu/utils.ts", import.meta.url),
  "utf8"
);
const editorUtils = await readFile(
  new URL("../components/editor/bubble-menu/utils.ts", import.meta.url),
  "utf8"
);
const blockEditorIndex = await readFile(
  new URL("../components/block-editor/index.ts", import.meta.url),
  "utf8"
);
const blockLanguageSelector = await readFile(
  new URL(
    "../components/block-editor/bubble-menu/language-selector.tsx",
    import.meta.url
  ),
  "utf8"
);
const editorLanguageSelector = await readFile(
  new URL(
    "../components/editor/bubble-menu/language-selector.tsx",
    import.meta.url
  ),
  "utf8"
);
const dropdownPill = await readFile(
  new URL("../components/extensions/ui/dropdown-pill.tsx", import.meta.url),
  "utf8"
);

// Selected/checked choices must keep a visible background while the glide pill
// is intentionally suppressed on them.
assert.match(constants, /data-checked:bg-accent/);
assert.match(toolbar, /active\s*&&\s*"[^"\n]*bg-accent/);
assert.match(codeBlock, /lang === language\s*&&\s*"[^"\n]*bg-accent/);
// The older editor dropdown has a separate pill implementation. Active
// items need an explicit marker and must clear that implementation's pill.
assert.match(rteDropdownItem, /data-selected=\{active \|\| undefined\}/);
assert.match(
  rteDropdown,
  /item\.hasAttribute\("data-selected"\)[\s\S]{0,80}setPill\(null\)/
);
// The instant-background neutralizer must not erase a selected background.
assert.match(globalStyles, /:not\(\[data-checked\]\):not\(\[data-selected\]\)/);
// The stale-pill guard must be hover-only: a selected tree row keeps DOM
// focus persistently, so :focus-visible would suppress the pill for every
// row hover, not just the moment an item becomes selected under the pointer.
assert.match(
  globalStyles,
  /:has\([\s\S]*\[data-dropdown-item\]\[data-selected\]:hover[\s\S]*\.ext-dropdown-pill/
);
assert.doesNotMatch(globalStyles, /focus-visible/);

// All three sliding-pill systems share one hover tint, lighter than each
// system's active/selected styling (10% or the accent token, currently 12%).
for (const styles of [extensionStyles, editorStyles, blockEditorStyles]) {
  assert.match(
    styles,
    /background: color-mix\(in srgb, var\(--primary\) 8%, transparent\)/
  );
}

// The code-language picker stacks selected and hovered rows adjacently, so
// its items need an explicit gap — otherwise the two backgrounds touch.
assert.match(codeBlock, /gap-\[2px\]/);

// Language icons follow the Catppuccin palette (as in the vscode-icons
// pack): one recognizable color per language, defined next to the language
// list each picker already imports.
for (const utils of [blockEditorUtils, editorUtils]) {
  assert.match(utils, /LANGUAGE_ICON_COLORS/);
  assert.match(utils, /javascript:\s*"#f9e2af"/);
  assert.match(utils, /typescript:\s*"#89b4fa"/);
}
assert.match(blockEditorIndex, /LANGUAGE_ICON_COLORS/);
for (const selector of [
  codeBlock,
  blockLanguageSelector,
  editorLanguageSelector,
]) {
  assert.match(selector, /LANGUAGE_ICON_COLORS/);
}

// Destructive rows (e.g. sidebar Delete) keep their own red hover/focus
// styling: the glide pill stays off them and the instant-background
// neutralizer must not erase their native destructive background.
assert.match(dropdownPill, /dataset\.variant === "destructive"/);
assert.match(globalStyles, /:not\(\s*\[data-variant="destructive"\]\s*\)/);

// Portal menus bubble React pointer/focus events to ancestor pills (e.g. a
// file context menu to the file-tree pill). A pill must only track items
// actually contained in its own wrapper.
assert.match(dropdownPill, /currentTarget/);
assert.match(dropdownPill, /\.contains\(item\)/);

console.log("menu-selection checks passed");
