"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { addPostComment, createPost, toggleLike } from "./actions";

export function LikeButton({ postId, liked, count, names }: { postId: number; liked: boolean; count: number; names: string }) {
  const [, start] = useTransition();
  const [s, set] = useOptimistic({ liked, count }, (_: { liked: boolean; count: number }, n: { liked: boolean; count: number }) => n);
  return (
    <button
      type="button"
      title={names || undefined}
      onClick={() => start(async () => { set({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }); await toggleLike(postId, !s.liked); })}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.liked ? "bg-rose-50 text-rose-600" : "text-slate-500 hover:bg-slate-100")}
      aria-pressed={s.liked}
    >
      <Heart className={cn("h-3.5 w-3.5", s.liked && "fill-current")} /> {s.count || ""} {s.liked ? "Liked" : "Like"}
    </button>
  );
}

export function Composer() {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (fd) => { await createPost(fd); ref.current?.reset(); }} className="space-y-2">
      <textarea name="body" required maxLength={4000} rows={3} placeholder="Share an update, a win or a heads-up with the team…" className="field resize-y" />
      <div className="flex justify-end">
        <button className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Post</button>
      </div>
    </form>
  );
}

export function CommentInput({ postId }: { postId: number }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (fd) => { await addPostComment(fd); ref.current?.reset(); }} className="flex gap-2">
      <input type="hidden" name="post_id" value={postId} />
      <input name="body" required maxLength={2000} placeholder="Write a comment…" className="field h-9 text-sm" aria-label="Comment" />
      <button className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Reply</button>
    </form>
  );
}
