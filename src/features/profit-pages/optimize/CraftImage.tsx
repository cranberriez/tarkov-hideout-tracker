"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useState } from "react";
import type { ItemSummary } from "@/types/items";

export function CraftImage({ item, src, size = 56, className = "" }: {
  item?: ItemSummary;
  src?: string;
  size?: number;
  className?: string;
}) {
  const url = src ?? item?.iconLink ?? item?.gridImageLink ?? item?.image512pxLink;
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
    {url && failed !== url ? <Image src={url} alt="" width={size} height={size} unoptimized className="h-full w-full object-contain" onError={() => setFailed(url)} />
      : <Package aria-hidden="true" className="h-1/2 w-1/2 text-muted-foreground/50" />}
  </span>;
}
