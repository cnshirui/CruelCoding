"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListRefresh({ label = "刷新" }: { label?: string }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [refreshed, setRefreshed] = useState(false);

  function refresh() {
    setRefreshed(false);
    startTransition(() => {
      router.refresh();
      setRefreshed(true);
    });
  }

  return <div className="list-refresh"><Button variant="outline" type="button" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />{refreshing ? "正在刷新…" : label}</Button>{refreshed && !refreshing ? <span role="status"><Check aria-hidden="true" />已刷新</span> : null}</div>;
}
