"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonVariant } from "./button";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
  name,
  value,
  disabled,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      name={name}
      value={value}
      onClick={(e) => rememberSubmitter(e.currentTarget, name, value)}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/**
 * Which button submitted the form. The browser doesn't always hand the clicked button's name/value to a
 * React server action — the portal's Accept / Decline buttons arrived without it, so every acceptance was
 * recorded as a decline. Submit buttons call this: it clears the last choice and, if the button has a name,
 * stores its value in a hidden field that always reaches the action.
 */
export function rememberSubmitter(button: HTMLButtonElement, name?: string, value?: string) {
  const form = button.form;
  if (!form) return;
  form.querySelectorAll("input[data-submitter]").forEach((el) => el.remove());
  if (!name) return;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value ?? "";
  input.dataset.submitter = "";
  form.appendChild(input);
}
