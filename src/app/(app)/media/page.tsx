import type { Metadata } from "next";
import Link from "next/link";
import { Download, File, FileImage, FileText, Folder, FolderOpen, ImageIcon, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { deleteMedia } from "./actions";
import { MediaUploader, ShareButton } from "./uploader";

export const metadata: Metadata = { title: "Media" };

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const iconFor = (mime: string | null) => (mime?.startsWith("image/") ? FileImage : mime === "application/pdf" || mime?.startsWith("text/") ? FileText : File);

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  await requireFeature("media"); // Setup → Modules
  const sp = await searchParams;
  const { supabase, profile } = await requireStaff();
  const { data: all } = await supabase
    .from("media_files")
    .select("id, folder, name, size, mime, created_at, uploaded_by, uploader:profiles!media_files_uploaded_by_fkey(full_name)")
    .order("created_at", { ascending: false });
  const folders = [...new Set((all ?? []).map((f) => f.folder))].sort();
  const files = (all ?? []).filter((f) => !sp.folder || f.folder === sp.folder);
  const total = (all ?? []).reduce((s, f) => s + Number(f.size), 0);

  return (
    <>
      <PageHeader title="Media library" description={`Shared files for the whole team — logos, brochures, price lists. ${all?.length ?? 0} files · ${size(total)}`} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          <Link href="/media" className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium", !sp.folder ? "bg-white text-brand-700 shadow-card ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60")}>
            <ImageIcon className="h-4 w-4" /> All files <span className="ml-auto text-xs text-slate-400">{all?.length ?? 0}</span>
          </Link>
          {folders.map((f) => (
            <Link key={f} href={`/media?folder=${encodeURIComponent(f)}`} className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium", sp.folder === f ? "bg-white text-brand-700 shadow-card ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60")}>
              {sp.folder === f ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />} {f}
              <span className="ml-auto text-xs text-slate-400">{(all ?? []).filter((x) => x.folder === f).length}</span>
            </Link>
          ))}
        </nav>
        <div className="space-y-4">
          <Card className="p-4">
            <MediaUploader folder={sp.folder ?? "General"} folders={folders} />
          </Card>
          <Card>
            {!files.length ? (
              <EmptyState icon={Folder} title="No files yet" description="Upload brochures, logos and templates to share them with the team." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {files.map((f) => {
                  const Icon = iconFor(f.mime);
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <a href={`/media/file/${f.id}?inline=1`} target="_blank" rel="noreferrer" className="block truncate font-medium text-slate-800 hover:text-brand-700">{f.name}</a>
                        <span className="block text-xs text-slate-400">{f.folder} · {size(Number(f.size))} · {f.uploader?.full_name ?? "—"} · {formatDate(f.created_at)}</span>
                      </span>
                      <ShareButton id={f.id} />
                      <a href={`/media/file/${f.id}`} className="rounded p-1 text-slate-400 hover:text-brand-700" aria-label={`Download ${f.name}`}><Download className="h-4 w-4" /></a>
                      {(f.uploaded_by === profile.id || profile.is_admin) && (
                        <ConfirmForm action={deleteMedia} message={`Delete ${f.name}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={`Delete ${f.name}`}><Trash2 className="h-4 w-4" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
