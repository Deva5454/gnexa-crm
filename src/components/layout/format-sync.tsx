"use client";

import { setFormatConfig, type FormatConfig } from "@/lib/format-config";

/** Gives the browser the same number and date formats the server used (rendered before the page content). */
export function FormatSync({ config }: { config: FormatConfig }) {
  setFormatConfig(config);
  return null;
}
