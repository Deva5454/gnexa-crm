/** Renders the knowledge-base plain-text format: paragraphs, bullet (•, -) and numbered (1.) lists. */
export function ArticleBody({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*[•-]\s+/.test(l)))
          return <ul key={i} className="list-disc space-y-1 pl-6">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*[•-]\s+/, "")}</li>)}</ul>;
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return <ol key={i} className="list-decimal space-y-1 pl-6">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*\d+[.)]\s+/, "")}</li>)}</ol>;
        return <p key={i} className="whitespace-pre-wrap">{b}</p>;
      })}
    </div>
  );
}
