import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const { profile } = await requireStaff();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My profile" description={profile.is_admin ? "Administrator" : "Staff member"} />
      <ProfileForm fullName={profile.full_name} phone={profile.phone ?? ""} jobTitle={profile.job_title ?? ""} email={profile.email} />
      <PasswordForm />
    </div>
  );
}
