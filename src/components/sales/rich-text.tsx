import { Fragment } from "react";

/**
 * Proposal content with light formatting — the subset of Markdown people type naturally:
 *   # / ## / ### headings · **bold** · *italic* · [link](https://…) · "- " bullet lists · "1. " numbered lists · blank line = new paragraph
 * Merge fields like {customer_name} are filled from `vars`. Everything is rendered as React text, never as
 * HTML, so content (or a client-supplied name) can't inject markup.
 */
export function RichText({ text, vars = {}, className }: { text: string; vars?: Record<string, string>; className?: string }) {
  const filled = text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));
  const blocks: React.ReactNode[] = [];
  const lines = filled.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1]!.length;
      const cls = level === 1 ? "text-lg font-bold text-slate-900" : level === 2 ? "text-base font-semibold text-slate-900" : "text-sm font-semibold text-slate-800";
      blocks.push(<p key={i} className={`${cls} mt-4 first:mt-0`}>{inline(h[2]!)}</p>);
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/).test(lines[i]!)) {
        items.push(lines[i]!.replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={i} className={`${ordered ? "list-decimal" : "list-disc"} mt-2 space-y-1 pl-5`}>
          {items.map((t, j) => <li key={j}>{inline(t)}</li>)}
        </List>,
      );
      continue;
    }
    // paragraph: consecutive plain lines, kept as line breaks
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,3})\s+/.test(lines[i]!) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]!)) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(
      <p key={i} className="mt-2 first:mt-0">
        {para.map((t, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(t)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={className}>{blocks}</div>;
}

/** **bold**, *italic*, [links](https://…) and bare https:// addresses inside a line. Only http(s) links are made clickable. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={m.index} className="font-semibold text-slate-800">{m[1]}</strong>);
    else if (m[2] != null) out.push(<em key={m.index}>{m[2]}</em>);
    else {
      const href = m[4] ?? m[5]!;
      out.push(
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600">
          {m[3] ?? href}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The merge fields proposals understand, filled from a document. */
export function proposalVars(v: { customer: string; number: string; total: string; openTill: string; date: string; company: string }) {
  return { customer_name: v.customer, proposal_number: v.number, total: v.total, open_till: v.openTill, date: v.date, company_name: v.company };
}
export const PROPOSAL_FIELDS = ["customer_name", "proposal_number", "total", "open_till", "date", "company_name"];
