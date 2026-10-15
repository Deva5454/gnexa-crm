import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveProject } from "../../actions";
import { projectFormOptions } from "../../form-data";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile } = await requireAccess("projects", "edit", `/projects/${id}`);
  const [{ data: project }, { data: members }, opts] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("staff_id").eq("project_id", id),
    projectFormOptions(supabase),
  ]);
  if (!project) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${project.name}`} />
      <ProjectForm
        action={saveProject.bind(null, id)}
        project={project}
        memberIds={(members ?? []).map((m) => m.staff_id)}
        {...opts}
        currentUserId={profile.id}
        cancelHref={`/projects/${id}`}
      />
    </div>
  );
}
