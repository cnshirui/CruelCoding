"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CheckinsRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <Button variant="outline" type="button" onClick={refresh} disabled={refreshing}>
      <RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
      {refreshing ? "正在刷新…" : "刷新"}
    </Button>
  );
}
