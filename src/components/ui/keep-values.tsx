"use client";

import { useEffect, useRef } from "react";

type Snap = { el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; value: string; checked: boolean; selected: boolean[] };

/**
 * React resets a form after its action finishes — even when the action returned an error, which wipes
 * what the person typed. Rendered inside a form, this puts their input back whenever the form is reset
 * while `active` (an error is showing).
 */
export function KeepValues({ active }: { active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let snap: Snap[] = [];
    const onSubmit = () => {
      snap = [];
      for (const el of Array.from(form.elements)) {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
        if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "hidden" || el.type === "submit" || el.type === "button")) continue;
        snap.push({
          el,
          value: el.value,
          checked: el instanceof HTMLInputElement ? el.checked : false,
          selected: el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => o.selected) : [],
        });
      }
    };
    const onReset = () => {
      // let the reset finish (and the error render) before deciding
      setTimeout(() => {
        if (!activeRef.current) return;
        for (const s of snap) {
          if (!s.el.isConnected) continue;
          if (s.el instanceof HTMLInputElement && (s.el.type === "checkbox" || s.el.type === "radio")) s.el.checked = s.checked;
          else if (s.el instanceof HTMLSelectElement && s.el.multiple) Array.from(s.el.options).forEach((o, i) => (o.selected = !!s.selected[i]));
          else s.el.value = s.value;
        }
      }, 0);
    };
    form.addEventListener("submit", onSubmit, true);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("submit", onSubmit, true);
      form.removeEventListener("reset", onReset);
    };
  }, []);

  return <span ref={ref} hidden />;
}
