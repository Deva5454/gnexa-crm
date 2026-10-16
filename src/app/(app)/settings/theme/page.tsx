import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { THEMES } from "@/lib/theme";
import { saveTheme } from "../actions";

export const metadata: Metadata = { title: "Theme style" };

export default async function ThemePage() {
  const { settings } = await requireAdmin();
  return (
    <Card>
      <CardHeader title="Theme style" description="The brand colour used for buttons, highlights and the client portal." />
      <CardBody>
        <form action={saveTheme} className="space-y-5">
          <fieldset>
            <legend className="sr-only">Colour preset</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(THEMES).map(([key, t]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-slate-900 has-[:checked]:ring-2 has-[:checked]:ring-slate-900/10">
                  <input type="radio" name="theme" value={key} defaultChecked={settings.theme === key} className="sr-only" />
                  <span className="flex shrink-0 overflow-hidden rounded-lg">
                    {([300, 500, 700] as const).map((s) => <span key={s} className="h-8 w-4" style={{ backgroundColor: t.colors[s] }} />)}
                  </span>
                  <span className="font-medium text-slate-700">{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton pendingText="Saving…">Apply theme</SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
