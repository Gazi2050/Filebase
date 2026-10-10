import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { useBlockEditorContext } from "../context";
import { DEFAULT_ICONS } from "../icons";
import {
  BubbleButton,
  BubbleDropdown,
  BubbleDropdownIcon,
  BubbleDropdownItem,
  DropdownOverlay,
} from "../ui";
import {
  CODE_BLOCK_LANGUAGES,
  getLanguageLabel,
  LANGUAGE_ICON_COLORS,
  useEditorState,
  shallowEqual,
} from "./utils";

export const LanguageSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const { icons } = useBlockEditorContext();

  const { currentLanguage } = useEditorState(
    editor,
    (ed) => ({
      currentLanguage: ed.getAttributes("codeBlock").language || "javascript",
    }),
    shallowEqual
  );

  const langIcon =
    icons.languageIcons[currentLanguage] ?? icons.codeBlockLanguageIcon;
  const langColor = LANGUAGE_ICON_COLORS[currentLanguage];

  return (
    <div style={{ position: "relative" }}>
      <BubbleButton
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        <BubbleDropdownIcon>
          <span
            style={{ color: langColor ?? "currentColor", display: "contents" }}
          >
            {langIcon}
          </span>
        </BubbleDropdownIcon>
        <span className="block-editor-bubble-btn-text">
          {getLanguageLabel(currentLanguage)}
        </span>
        {DEFAULT_ICONS.dropdownArrowIcon}
      </BubbleButton>
      {open && (
        <>
          <DropdownOverlay
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          <BubbleDropdown align="language" style={{ left: "auto", right: 0 }}>
            {CODE_BLOCK_LANGUAGES.map((lang) => (
              <BubbleDropdownItem
                key={lang}
                active={currentLanguage === lang}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("codeBlock", { language: lang })
                    .run();
                  setOpen(false);
                }}
              >
                <BubbleDropdownIcon>
                  <span
                    style={{
                      color: LANGUAGE_ICON_COLORS[lang] ?? "currentColor",
                      display: "contents",
                    }}
                  >
                    {icons.languageIcons[lang] ?? icons.codeBlockLanguageIcon}
                  </span>
                </BubbleDropdownIcon>
                <span>{getLanguageLabel(lang)}</span>
              </BubbleDropdownItem>
            ))}
          </BubbleDropdown>
        </>
      )}
    </div>
  );
};
