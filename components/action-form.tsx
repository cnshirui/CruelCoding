"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/app/ai-agents/actions";

// Wraps a server action so any form shows pending state and the action's result message.
export function ActionForm({ action, children, className }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; children: React.ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return <form action={formAction} className={className} aria-busy={pending}>{children}{state ? <p role="status" className={`form-message${state.ok ? "" : " error"}`}>{state.message}</p> : null}</form>;
}

export function SubmitButton({ children, pendingLabel = "提交中…", ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} {...props}>{pending ? pendingLabel : children}</Button>;
}
