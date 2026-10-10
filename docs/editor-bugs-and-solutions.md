# Editor Bugs and Proposed Solutions

This document records the editor issues observed in the headless-browser audit and proposes targeted fixes. **It is documentation only; no implementation changes are included here.**

## Confidence key

- **Confirmed:** reproduced in the browser and/or verified in the saved document data.
- **Needs product decision:** an observed behavior may be intentional; agree on expected UX before changing it.
- **Not yet verified:** evidence was inconclusive, so do not treat it as a confirmed defect.

---

## Confirmed bugs

### 1. Applying inline Code removes other formatting without warning

**Severity:** Medium — silent content-format loss.

**Observed behavior:** Selecting text formatted with bold, italic, underline, and strikethrough, then applying inline Code, left only `<code>…</code>`. The other marks were gone. Applying code to text with text color and highlight also removed those marks. Applying bold while the cursor was inside inline code did not visibly apply bold.

**Likely area:** Inline code mark configuration and formatting controls under `components/templates/simple-document-editor/`.

**Proposed solution:** Choose and enforce a documented formatting rule. Prefer preserving compatible marks when adding/removing inline code if supported by Tiptap's mark model. If code is intentionally exclusive, make that behavior explicit in the UI and avoid presenting other formatting actions as if they succeeded while the selection is code. Do not silently discard existing formatting without a deliberate product choice.

**Regression checks:**

1. Apply code to text with bold, italic, underline, strike, color, highlight, link, superscript, and subscript separately and in combinations.
2. Verify the expected marks in editor JSON and rendered HTML after apply, remove, undo, and reload.
3. Verify that a toolbar action that cannot apply to code is disabled or otherwise communicates its behavior.

### 2. Inserted tables do not receive the intended column widths

**Severity:** Medium — table layout differs from the editor's stated design and saved data.

**Observed behavior:** The custom table insertion command intends to stamp each cell with `colwidth: [128]`. In the browser, cells had no `data-colwidth`, and the rendered `<colgroup>` used `min-width: 25px`. Reading the saved content from IndexedDB confirmed `colwidth: null` on inserted header and body cells. The table was still approximately content-column width, but the intended uniform 128px-per-column sizing was absent.

**Likely area:** `components/templates/simple-document-editor/table.ts`, especially the custom `insertTable` command (around lines 42–59).

**Proposed solution:** Correct the insertion transaction so the width attributes are applied to the actual inserted cell nodes at their current transaction positions. Ensure the command uses the right mapping/positions after replacing the selection and that it does not overwrite the updated node attributes with stale node data. Keep the six-column width policy consistent with the editor's content column.

**Regression checks:**

1. Insert the default 3-row, 6-column table.
2. Assert each header and body cell has the expected width attribute in editor JSON.
3. Assert the DOM colgroup renders the expected width, not only the fallback minimum width.
4. Wait for auto-save, reload, and assert widths remain present.
5. Check console output during insertion for the observed ProseMirror `TextSelection endpoint not pointing into a node with inline content (doc)` warning; isolate and resolve it if it reproduces.

### 3. Table column menu offers actions that cannot work at the column limit

**Severity:** Medium — users can invoke a visible action and get no result.

**Observed behavior:** With six columns, “Insert Left” and “Insert Right” remained available in the column action menu. Selecting “Insert Right” left the table at six columns. The separate add-column handle was correctly hidden at the limit, so the UI is inconsistent.

**Likely areas:**

- `components/extensions/table/table-hover-overlay.tsx` — column menu items and add handle.
- `components/templates/simple-document-editor/table.ts` — maximum-column command guards.

**Proposed solution:** Use the same column-count/maximum-limit condition for every add-column affordance. At the limit, hide or disable both menu actions and expose a brief accessible explanation (for example, “Maximum 6 columns”). Retain the command-level guard as a safety check even when the UI disables the action.

**Regression checks:**

1. At five columns, both menu actions work and the table becomes six columns.
2. At six columns, both menu actions are disabled or absent and the add handle is absent.
3. Attempting the guarded command programmatically does not mutate the document.
4. Keyboard users receive the same disabled state and explanation as pointer users.

### 4. Table row/column action menus remain open after an action

**Severity:** Medium — the open menu intercepts pointer interaction over the editor.

**Observed behavior:** After a column action (including a successful delete/insert and the no-op at the cap) or a row action, the dropdown remained open. The menu continued intercepting pointer events over the table until dismissed with Escape or by clicking elsewhere. This was reproduced for row and column menus.

**Likely area:** `components/extensions/table/table-hover-overlay.tsx`, in `ColumnControl`, `RowControl`, and the controlled `colMenuOpen` / `rowMenuOpen` state handlers (around lines 53–175 and 478–483).

**Proposed solution:** Explicitly close the corresponding controlled menu after an action is selected, regardless of whether the command succeeds. Preserve keyboard dismissal and menu focus behavior. Avoid relying solely on the menu library's uncontrolled auto-close behavior because these menus have controlled `open` state.

**Regression checks:**

1. Each row and column action closes its menu after selection.
2. A rejected action at the six-column limit also closes the menu.
3. Following an action, a pointer can immediately hover/click another table cell.
4. Escape and outside-click continue to close the menus.

### 5. Slash command uses a hidden trigger filter separate from its visible search

**Severity:** Medium — commands can appear unavailable even when their visible title matches the query.

**Observed behavior:** Typing `/quo` and pressing Enter did not select Quote; the trigger query filters command items by keyword prefix, and Quote's keyword is `blockquote`, which does not start with `quo`. The slash menu also has a separate visible search input whose value remains empty, even though its list is already filtered by the editor query. By contrast, `/head` worked because `heading` starts with `head`.

**Likely areas:**

- `components/block-editor/extensions/slash-command/suggestion.ts` — `items` query filtering (around lines 185–189).
- `components/block-editor/extensions/slash-command/suggestion-list.tsx` — separate `searchQuery` state and filtering (around lines 34–44 and 119–144).

**Proposed solution:** Establish one consistent query model. The text following `/` should filter command titles and keywords using a consistent case-insensitive substring/prefix policy. The menu's visible search field should reflect that query, or be removed if it is not meant to be independently editable. Ensure keyboard selection and Enter act on the same visible filtered list.

**Regression checks:**

1. `/quo` exposes Quote and Enter inserts a blockquote while removing the trigger text.
2. `/head` exposes heading commands.
3. `/table` has a documented expected result (either a table command appears or the query clearly has no match).
4. An unmatched query displays a meaningful empty state that contains the actual query.
5. Arrow navigation, mouse selection, Enter, and Escape operate on the displayed results.

### 6. Code-language menu items have no accessible names in the browser accessibility snapshot

**Severity:** Medium — keyboard/screen-reader users may be unable to identify language choices.

**Observed behavior:** The language menu displayed 21 options and each option had visible DOM text (for example, “JavaScript”), but the headless browser's accessibility snapshot exposed them as unnamed `menuitem`s. Other editor menus exposed their item names.

**Likely area:** `components/templates/simple-document-editor/code-block.tsx`, specifically the language dropdown items and `LanguageIcon` (around lines 28–35 and 69–90).

**Proposed solution:** Ensure each menu item has a reliable accessible name derived from its language label, independent of the icon. Inspect the rendered accessibility tree to identify whether the label is hidden, excluded, or otherwise not associated with the menu item. Add an explicit accessible label only if the underlying item composition does not expose its text correctly.

**Regression checks:**

1. Accessibility snapshot names every language option.
2. Keyboard navigation announces each option and selected state.
3. Choosing a language updates the selected label and syntax highlighting.

---

## Needs product decision before changing behavior

These behaviors were observed, but are not automatically defects. Confirm the intended UX, then either document them as intentional or implement the chosen behavior with tests.

### 7. Empty link URL can be saved and closes the dialog silently

**Observed behavior:** The Save button is enabled with an empty URL. Clicking it closes the dialog and applies no link, without an error message.

**Likely area:** `components/editor/controls/rte-link-control.tsx`.

**Proposed solution if invalid input should be rejected:** Disable Save until a valid URL is entered, or keep the dialog open and show a specific validation message. Validate the same URL formats the link extension supports.

**Regression checks:** Empty/whitespace URL, valid HTTP(S) URL, and malformed URL each have an explicit expected outcome.

### 8. Link dialog has no dedicated unlink action

**Observed behavior:** Reopening the link dialog on linked text prefilled the current URL, but exposed only Save. Clear formatting removed the link, but also clears other marks.

**Likely area:** `components/editor/controls/rte-link-control.tsx` and `components/templates/simple-document-editor/toolbar.tsx`.

**Proposed solution if direct unlink is desired:** Add a dedicated “Remove link” action that unsets only the link mark and preserves other marks. Do not use Clear formatting as a substitute.

**Regression checks:** Remove a link from mixed-format text and verify bold/color/etc. remain; verify removing an unlinked selection is disabled or harmless.

### 9. Image action labeled “Full width” sets `fit-content`

**Observed behavior:** Selecting “Full width” set the image wrapper width to `fit-content`, which may shrink to intrinsic content size rather than fill the editor column.

**Likely area:** `components/extensions/image-placeholder/image.tsx`, around line 278.

**Proposed solution if “Full width” means fill the content column:** Set the wrapper width to the editor's available content width (or a responsive `100%` constrained by the parent). If `fit-content` is intended, rename the action so its label matches its behavior.

**Regression checks:** Test intrinsic-small and wide images at narrow and wide viewport widths; verify the action label matches the resulting layout.

### 10. Task-list toggle converts only the selected item, splitting an existing list

**Observed behavior:** Toggling a task list while the cursor was in a list item converted the current item and split the surrounding list. This follows Tiptap's list-toggle behavior but may differ from a whole-list editor UX.

**Likely area:** `components/templates/simple-document-editor/toolbar.tsx`, task-list control around line 347; same command is also used by the shortcut and slash command.

**Proposed solution if whole-list conversion is intended:** Implement a shared command that converts all selected/current list items as a unit and use it from toolbar, keyboard shortcut, and slash command. Otherwise, retain the current behavior and add a UI regression check/documentation so it is not mistakenly fixed in only one entry point.

**Regression checks:** Convert a two-item list in both directions and verify expected grouping, item text, checked states, nesting, and undo behavior.

### 11. Markdown list/quote triggers inside an existing list

**Observed behavior:** `1. ` and `> ` did not convert when typed inside a list item; the typed characters remained literal. Markdown conversion from a clean paragraph worked in tested cases.

**Likely area:** Tiptap StarterKit input rules and editor extension configuration in `components/templates/simple-document-editor/index.tsx`.

**Proposed solution if nested-context conversion is required:** Add explicit input-rule coverage for list-item contexts, while ensuring existing list items are not unexpectedly destroyed. If stock Tiptap behavior is acceptable, document it as a limitation rather than adding custom rules.

**Regression checks:** Test each trigger in an empty paragraph, at the start of a list item, and after existing text; assert content is neither lost nor duplicated.

### 12. Image resizing cannot grow beyond the parent width

**Observed behavior:** Shrinking an image worked. A drag intended to enlarge an image beyond its parent width produced no visible change; the implementation only updates width when the proposed width is less than the parent width.

**Likely area:** `components/extensions/image-placeholder/image.tsx`, resize handlers around lines 68–80 and 116–133.

**Proposed solution if full-width growth is expected:** Clamp the width to the parent width and allow a value equal to that width; communicate the max-width boundary. If growth beyond the editor column is not intended, retain the clamp and provide a clear visual affordance that the image has reached its maximum.

**Regression checks:** Shrink, grow within parent, reach the exact parent width, attempt beyond max, and repeat from left and right handles. Test mouse and touch.

---

## Not confirmed by this audit

### HTML paste sanitization and pasted table sizing

Synthetic browser HTML clipboard events were unreliable in the headless run: an emoji paste probe produced unexpected content and an oversized-table probe did not insert a table. This does **not** establish a product bug. Existing checks include `scripts/check-paste-sanitize.ts` and `scripts/check-doc-content.ts`; verify browser paste using a real clipboard workflow before adding a fix.

### Collaboration and shared/read-only editor modes

These require a live collaboration document and a valid shared/read-only route. They were not exercised in the browser audit and should be tested separately before claiming those modes are verified.

---

## Suggested implementation sequence

1. Fix and regression-test inserted table widths.
2. Fix table action menu closure and make column-limit states explicit.
3. Unify slash-command filtering and visible search state.
4. Resolve inline-code mark exclusivity and formatting-loss behavior.
5. Fix language-option accessible names and assert them in an accessibility snapshot.
6. Get product decisions for items 7–12; implement only the accepted behavior changes.
7. Re-run focused browser scenarios, `npm run check`, and `npm run lint`; then audit collaboration/read-only and real clipboard paste separately.

## Existing browser evidence summary

The audit also observed working behavior for toolbar marks and shortcuts, basic headings and Markdown triggers, list nesting/exit/lift, task checkbox changes, table row/column changes below the limit, drag-handle reordering, image URL embed/upload/actions/resize/delete/undo, code-block language selection/copy/highlighting, link creation/autolink/edit-prefill, word/character counts, and saved content surviving reload. These are tested paths, not a proof that every input, browser, or viewport is bug-free.
