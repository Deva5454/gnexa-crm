import { RichText } from "@/components/sales/rich-text";

/**
 * Knowledge-base article text: paragraphs, # headings, **bold**, *italic*, [links](https://…),
 * bullet (•, -) and numbered (1.) lists. Rendered as React text, never raw HTML.
 */
export function ArticleBody({ text }: { text: string }) {
  return <RichText text={text} className="text-[15px] leading-7 text-slate-700 [&_li]:leading-7" />;
}

/** Article text without formatting marks, for list previews: "[docs](https://…)" → "docs". */
export function plainExcerpt(text: string, max = 160) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
