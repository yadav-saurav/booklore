"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReviewResult } from "@/app/actions/reviews";

/** Like useAuthAction, but surfaces validation messages from the review actions. */
export function useReviewAction() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ReviewResult>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        onOk?.();
        router.refresh();
      } else if (r.error === "auth") {
        const q = search.toString();
        router.push(`/signin?next=${encodeURIComponent(pathname + (q ? `?${q}` : ""))}`);
      } else {
        setError("message" in r ? r.message : "Something went wrong");
      }
    });
  return { run, pending, error, setError };
}
