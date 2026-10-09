"use client";

import type { NodeViewProps } from "@tiptap/react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";

import { CodeBlock, DEFAULT_LANGUAGE_ICONS } from "@/components/editor";
import {
  CODE_BLOCK_LANGUAGES,
  getLanguageLabel,
} from "@/components/block-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LanguageIcon = ({ lang }: { lang: string }) => (
  <>{DEFAULT_LANGUAGE_ICONS[lang] ?? <span className="size-3.5" />}</>
);

const CodeBlockView = ({ node, updateAttributes }: NodeViewProps) => {
  const language: string = node.attrs.language ?? "plaintext";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions/insecure context)
    }
  };

  return (
    <NodeViewWrapper className="doc-code-block relative">
      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Code language"
                className="h-6 gap-1 rounded-md border border-border bg-[#1c1c1c] px-1.5 text-xs"
                size="sm"
                variant="ghost"
              />
            }
          >
            <LanguageIcon lang={language} />
            <span>{getLanguageLabel(language)}</span>
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="doc-editor-menu doc-editor-language-menu max-h-64 overflow-y-auto p-1"
          >
            {CODE_BLOCK_LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang}
                className={cn(
                  "rounded-md py-1 text-[13px] [&_svg]:size-3.5!",
                  lang === language && "bg-accent text-accent-foreground"
                )}
                onClick={() => updateAttributes({ language: lang })}
              >
                <LanguageIcon lang={lang} />
                {getLanguageLabel(lang)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          aria-label="Copy code"
          className="h-6 w-6 rounded-md border border-border bg-[#1c1c1c] p-0"
          size="sm"
          variant="ghost"
          onClick={copy}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

export const DocumentCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
