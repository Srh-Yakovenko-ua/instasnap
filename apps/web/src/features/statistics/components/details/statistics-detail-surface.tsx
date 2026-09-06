"use client";

import type { ReactNode } from "react";

import { useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type StatisticsDetailSurfaceProps = {
  children: ReactNode;
  contentClassName?: string;
  detail: (context: { close: () => void }) => ReactNode;
  label: string;
  title: string;
  triggerClassName?: string;
};

export function StatisticsDetailSurface({
  children,
  contentClassName,
  detail,
  label,
  title,
  triggerClassName,
}: StatisticsDetailSurfaceProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  if (isMobile) {
    return (
      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerTrigger
          aria-label={label}
          className={cn("cursor-pointer text-left", triggerClassName)}
        >
          {children}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className={cn("overflow-y-auto px-5 py-4", contentClassName)}>
            {open ? detail({ close }) : null}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={label}
        className={cn("cursor-pointer text-left", triggerClassName)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-80", contentClassName)}>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        {open ? detail({ close }) : null}
      </PopoverContent>
    </Popover>
  );
}
