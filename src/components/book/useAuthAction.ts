"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ActionResult } from "@/app/actions/engagement";

/** Run a server action; bounce to sign-in (and back) when the user is anonymous. */
export function useAuthAction() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error === "auth") router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      else if (r.ok) {
        onOk?.();
        router.refresh();
      }
    });
  return { run, pending };
}
