"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { trackView, voteArticle } from "../actions";

export function ArticleFeedback({ id }: { id: number }) {
  const [voted, setVoted] = useState<boolean | null>(null);
  useEffect(() => {
    // Count one view per article per browser session
    const key = `gnexa:kb:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    trackView(id);
  }, [id]);

  if (voted != null) return <p className="text-sm text-emerald-600">Thanks for the feedback!</p>;
  const vote = (yes: boolean) => {
    setVoted(yes);
    voteArticle(id, yes);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      Was this article helpful?
      <button onClick={() => vote(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
        <ThumbsUp className="h-4 w-4" /> Yes
      </button>
      <button onClick={() => vote(false)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700">
        <ThumbsDown className="h-4 w-4" /> No
      </button>
    </div>
  );
}
