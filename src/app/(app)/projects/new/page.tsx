import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveProject } from "../actions";
import { projectFormOptions } from "../form-data";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess("projects", "edit", "/projects");
  const opts = await projectFormOptions(supabase);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New project" description="Plan the work, track time and bill it." />
      <ProjectForm action={saveProject.bind(null, null)} {...opts} currentUserId={profile.id} defaultCustomer={Number(sp.customer) || undefined} cancelHref="/projects" />
    </div>
  );
}
