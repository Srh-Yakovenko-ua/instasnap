import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export type UiIconName =
  | "alert-circle"
  | "alert-triangle"
  | "apple"
  | "arrow-down"
  | "arrow-down-circle"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "arrow-up-right"
  | "at"
  | "bell"
  | "bell-off"
  | "book"
  | "book-copy"
  | "book-x"
  | "bookmark"
  | "building"
  | "bulb"
  | "calendar"
  | "camera"
  | "cart"
  | "chart"
  | "chart-increasing"
  | "check"
  | "check-check"
  | "check-circle"
  | "check-square"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "circle-slash"
  | "clock"
  | "cloud-up"
  | "copy"
  | "crown"
  | "download"
  | "edit"
  | "external"
  | "eye"
  | "eye-off"
  | "file"
  | "file-warning"
  | "filter"
  | "flame"
  | "funnel"
  | "globe"
  | "google"
  | "grip"
  | "hash"
  | "headphones"
  | "heart"
  | "heart-fill"
  | "help-circle"
  | "home"
  | "image"
  | "inbox"
  | "info"
  | "key"
  | "layers"
  | "leaf"
  | "library"
  | "library-big"
  | "link"
  | "list"
  | "lock"
  | "login"
  | "logout"
  | "mail"
  | "menu"
  | "minus"
  | "monitor"
  | "moon"
  | "more"
  | "note"
  | "package"
  | "package-check"
  | "pages"
  | "palette"
  | "panel"
  | "phone"
  | "pie"
  | "plus"
  | "quote"
  | "refresh"
  | "ruler"
  | "search"
  | "sessions"
  | "settings"
  | "share"
  | "shield"
  | "shopping-bag"
  | "sliders"
  | "sparkles"
  | "sprig"
  | "star"
  | "star-fill"
  | "store"
  | "sun"
  | "swap"
  | "tablet"
  | "tag"
  | "target"
  | "trash"
  | "trend-down"
  | "trend-up"
  | "trophy"
  | "truck"
  | "type"
  | "upload"
  | "user"
  | "wallet"
  | "x"
  | "x-circle";

type UiIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: UiIconName;
  size?: number;
  title?: string;
};

export function UiIcon({ className, name, size = 20, title, ...props }: UiIconProps) {
  const labelled = title !== undefined || props["aria-label"] !== undefined;

  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      className={cn("shrink-0", className)}
      fill="none"
      height={size}
      role={labelled ? "img" : undefined}
      width={size}
      {...props}
    >
      {title === undefined ? null : <title>{title}</title>}
      <use href={`/icons/ui-icons.svg#i-${name}`} />
    </svg>
  );
}
