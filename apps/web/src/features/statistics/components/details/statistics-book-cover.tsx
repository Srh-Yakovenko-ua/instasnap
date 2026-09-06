"use client";

import type { Nullable } from "@app/shared";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const COVER_SIZE = { height: 96, width: 64 } as const;

export function StatisticsBookCover({
  className,
  coverThumbUrl,
  title,
}: {
  className?: string;
  coverThumbUrl: Nullable<string>;
  title: string;
}) {
  if (coverThumbUrl === null) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary text-muted-foreground",
          className,
        )}
      >
        <UiIcon name="book" size={18} />
      </span>
    );
  }

  return (
    <Image
      alt={title}
      className={cn("aspect-[2/3] w-full rounded-md object-cover", className)}
      height={COVER_SIZE.height}
      src={coverThumbUrl}
      unoptimized
      width={COVER_SIZE.width}
    />
  );
}
