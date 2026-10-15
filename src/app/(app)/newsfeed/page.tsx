import type { Metadata } from "next";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { cn, timeAgo } from "@/lib/utils";
import { deletePost, deletePostComment, togglePin } from "./actions";
import { CommentInput, Composer, LikeButton } from "./parts";

export const metadata: Metadata = { title: "Newsfeed" };

export default async function NewsfeedPage() {
  const { supabase, profile } = await requireStaff();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, body, pinned, created_at, created_by, author:profiles!posts_created_by_fkey(full_name, job_title), post_likes(staff_id, staff:profiles(full_name)), post_comments(id, body, created_at, created_by, author:profiles!post_comments_created_by_fkey(full_name))")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Newsfeed" description="What's happening across the team." />
      <Card className="mb-6">
        <CardBody>
          <Composer />
        </CardBody>
      </Card>
      <div className="space-y-4">
        {(posts ?? []).map((p) => {
          const liked = p.post_likes.some((l) => l.staff_id === profile.id);
          const comments = [...p.post_comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
          return (
            <Card key={p.id} className={cn(p.pinned && "ring-2 ring-brand-200")}>
              <div id={`post-${p.id}`} className="scroll-mt-20 p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={p.author?.full_name} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <b className="text-slate-900">{p.author?.full_name ?? "Former staff"}</b>
                      {p.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700"><Pin className="h-3 w-3" /> Pinned</span>}
                    </div>
                    <div className="text-xs text-slate-400" suppressHydrationWarning>{p.author?.job_title ? `${p.author.job_title} · ` : ""}{timeAgo(p.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {profile.is_admin && (
                      <form action={togglePin}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="pin" value={p.pinned ? "0" : "1"} />
                        <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700" aria-label={p.pinned ? "Unpin" : "Pin to top"}>{p.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button>
                      </form>
                    )}
                    {(p.created_by === profile.id || profile.is_admin) && (
                      <ConfirmForm action={deletePost} message="Delete this post?">
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete post"><Trash2 className="h-4 w-4" /></button>
                      </ConfirmForm>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{p.body}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2">
                  <LikeButton postId={p.id} liked={liked} count={p.post_likes.length} names={p.post_likes.map((l) => l.staff?.full_name).filter(Boolean).join(", ")} />
                  <span className="text-xs text-slate-400">{comments.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : ""}</span>
                </div>
                {comments.length > 0 && (
                  <ul className="mt-3 space-y-2.5">
                    {comments.map((c) => (
                      <li key={c.id} className="group flex gap-2.5">
                        <Avatar name={c.author?.full_name} className="h-7 w-7 text-[10px]" />
                        <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span suppressHydrationWarning><b className="text-slate-700">{c.author?.full_name ?? "Former staff"}</b> · {timeAgo(c.created_at)}</span>
                            {(c.created_by === profile.id || profile.is_admin) && (
                              <ConfirmForm action={deletePostComment} message="Delete this comment?">
                                <input type="hidden" name="id" value={c.id} />
                                <button className="text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100" aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>
                              </ConfirmForm>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3"><CommentInput postId={p.id} /></div>
              </div>
            </Card>
          );
        })}
        {!posts?.length && <p className="text-center text-sm text-slate-400">No posts yet — say hello!</p>}
      </div>
    </div>
  );
}
