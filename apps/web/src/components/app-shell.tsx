"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import {
  ArrowUpRight,
  BookCopy,
  ChartColumnBig,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleArrowDown,
  Feather,
  HandHelping,
  Heart,
  History,
  Home,
  Landmark,
  Layers,
  Library,
  LibraryBig,
  ListChecks,
  ListOrdered,
  NotebookPen,
  Quote,
  Settings,
  ShoppingBag,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect, useState } from "react";

import { LocalePicker } from "@/components/locale-picker";
import { SessionMenu } from "@/components/session-menu";
import { ThemePicker } from "@/components/theme-picker";
import { TooltipHint } from "@/components/tooltip-hint";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NotificationBell } from "@/features/notifications";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavItem = NavLink | NavSection;

type NavKey =
  | "allBooks"
  | "buyList"
  | "dedications"
  | "delivery"
  | "favorites"
  | "genresTags"
  | "home"
  | "lists"
  | "loans"
  | "myLibrary"
  | "notes"
  | "publishers"
  | "quotes"
  | "readingQueue"
  | "series"
  | "settings"
  | "statistics";

type NavLink = {
  icon: React.ElementType;
  key: NavKey;
  kind: "link";
  to: string;
};

type NavMessageKey =
  | "delivery.subnav.history"
  | "delivery.subnav.inTransit"
  | "delivery.subnav.label"
  | "delivery.subnav.statistics"
  | "nav.loans"
  | "nav.loansBorrowed"
  | "nav.loansContacts"
  | "nav.loansHistory"
  | "nav.loansLent";

type NavSection = {
  children: readonly [NavSectionChild, ...NavSectionChild[]];
  icon: React.ElementType;
  key: NavKey;
  kind: "section";
  listLabelKey: NavMessageKey;
  pathPrefix: string;
};

type NavSectionChild = {
  icon: Nullable<React.ElementType>;
  labelKey: NavMessageKey;
  to: string;
};

type NavSectionToggle = {
  isOpen: boolean;
  pathname: string;
};

const NAV_ITEMS = [
  { icon: Home, key: "home", kind: "link", to: "/" },
  { icon: LibraryBig, key: "allBooks", kind: "link", to: "/books" },
  { icon: Library, key: "myLibrary", kind: "link", to: "/my-library" },
  { icon: Heart, key: "favorites", kind: "link", to: "/favorites" },
  { icon: Quote, key: "quotes", kind: "link", to: "/quotes" },
  { icon: ListOrdered, key: "readingQueue", kind: "link", to: "/reading-queue" },
  { icon: ShoppingBag, key: "buyList", kind: "link", to: "/books-to-buy" },
  {
    children: [
      { icon: CircleArrowDown, labelKey: "nav.loansBorrowed", to: "/loans/borrowed" },
      { icon: ArrowUpRight, labelKey: "nav.loansLent", to: "/loans/lent" },
      { icon: History, labelKey: "nav.loansHistory", to: "/loans/history" },
      { icon: Users, labelKey: "nav.loansContacts", to: "/loans/contacts" },
    ],
    icon: HandHelping,
    key: "loans",
    kind: "section",
    listLabelKey: "nav.loans",
    pathPrefix: "/loans",
  },
  {
    children: [
      { icon: null, labelKey: "delivery.subnav.inTransit", to: "/delivery/in-transit" },
      { icon: null, labelKey: "delivery.subnav.history", to: "/delivery/history" },
      { icon: null, labelKey: "delivery.subnav.statistics", to: "/delivery/statistics" },
    ],
    icon: Truck,
    key: "delivery",
    kind: "section",
    listLabelKey: "delivery.subnav.label",
    pathPrefix: "/delivery",
  },
  { icon: ChartColumnBig, key: "statistics", kind: "link", to: "/statistics" },
  { icon: Feather, key: "dedications", kind: "link", to: "/dedications" },
  { icon: BookCopy, key: "series", kind: "link", to: "/series" },
  { icon: Landmark, key: "publishers", kind: "link", to: "/publishers" },
  { icon: Tags, key: "genresTags", kind: "link", to: "/genres-tags" },
  { icon: ListChecks, key: "lists", kind: "link", to: "/lists" },
  { icon: NotebookPen, key: "notes", kind: "link", to: "/notes" },
  { icon: Settings, key: "settings", kind: "link", to: "/settings" },
] satisfies readonly NavItem[];

const NAV_STYLES = {
  activeIcon: "text-sidebar-active-foreground",
  activeItem:
    "bg-primary/10 text-sidebar-active-foreground hover:bg-primary/15 hover:text-sidebar-active-foreground",
  chevron:
    "ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180",
  icon: "size-[18px] shrink-0 transition-colors duration-150",
  idleIcon: "text-sidebar-foreground/70",
  idleItem: "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
  indicator: "absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary",
  item: "relative cursor-pointer gap-3 transition-all duration-150",
  label: "font-mono text-[12px] font-medium tracking-[0.14em] uppercase",
  subActiveChild: "bg-primary/10 text-sidebar-active-foreground hover:bg-primary/15",
  subChild:
    "flex h-7 min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 transition-colors duration-150 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  subIcon: "size-4 shrink-0",
  subIdleChild: "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
  subIndicator:
    "absolute top-1/2 -left-[11px] h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary",
  subLabel: "truncate font-mono text-[11px] font-medium tracking-[0.12em] uppercase",
} as const;

const ACTIVE_INDICATOR_TRANSITION = { damping: 34, stiffness: 420, type: "spring" } as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <SidebarProvider>
        <AppSidebar />
        <ContentArea>{children}</ContentArea>
      </SidebarProvider>
    </NuqsAdapter>
  );
}

function AppSidebar() {
  const tNav = useTranslations("nav");
  const tShell = useTranslations("appShell");
  const pathname = usePathname();
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-4 py-5">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-200",
            collapsed && "justify-center gap-0",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 shadow-[var(--shadow-soft)]">
            <Layers className="size-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              {tShell("label")}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                if (item.kind === "section") {
                  return <NavSectionMenuItem item={item} key={item.key} pathname={pathname} />;
                }

                return (
                  <SidebarMenuItem key={item.key}>
                    <NavMenuLink
                      href={item.to}
                      icon={item.icon}
                      isActive={pathname === item.to}
                      label={tNav(item.key)}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-0">
        <div className="flex items-center justify-end gap-2 px-3 py-3 group-data-[state=collapsed]:flex-col group-data-[state=collapsed]:justify-center">
          <button
            aria-label={collapsed ? tShell("expandSidebar") : tShell("collapseSidebar")}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground"
            onClick={toggleSidebar}
            type="button"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
        {!collapsed && (
          <Image
            alt=""
            className="mx-auto block size-[150px] select-none lg:h-auto lg:w-4/5"
            height={500}
            priority={false}
            src="/illustrations/sidebar.png"
            width={500}
          />
        )}
      </SidebarFooter>

      <TooltipHint label={collapsed ? tShell("expandSidebar") : tShell("collapseSidebar")}>
        <SidebarRail
          aria-label={collapsed ? tShell("expandSidebar") : tShell("collapseSidebar")}
          title={undefined}
        />
      </TooltipHint>
    </Sidebar>
  );
}

function ContentArea({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 0%, oklch(from var(--primary) l c h / 0.07), transparent 60%),
            radial-gradient(ellipse 50% 60% at 92% 95%, oklch(from var(--info) l c h / 0.05), transparent 55%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.018]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <header className="sticky top-0 z-30 flex h-[var(--shell-header-height)] shrink-0 items-center gap-4 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex min-w-0 flex-1 items-center">
          <SidebarTrigger className="size-8 cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground lg:hidden" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <SessionMenu />
          <ThemePicker />
          <LocalePicker />
        </div>
      </header>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function NavMenuLink({
  href,
  icon: Icon,
  isActive,
  label,
}: {
  href: string;
  icon: React.ElementType;
  isActive: boolean;
  label: string;
}) {
  return (
    <SidebarMenuButton
      asChild
      className={cn(NAV_STYLES.item, isActive ? NAV_STYLES.activeItem : NAV_STYLES.idleItem)}
      isActive={isActive}
      tooltip={label}
    >
      <Link href={href}>
        <Icon
          className={cn(NAV_STYLES.icon, isActive ? NAV_STYLES.activeIcon : NAV_STYLES.idleIcon)}
        />
        <span className={NAV_STYLES.label}>{label}</span>
        {isActive && (
          <motion.div
            className={NAV_STYLES.indicator}
            layoutId="sidebar-active-indicator"
            transition={ACTIVE_INDICATOR_TRANSITION}
          />
        )}
      </Link>
    </SidebarMenuButton>
  );
}

function NavSectionMenuItem({ item, pathname }: { item: NavSection; pathname: string }) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const { isMobile, state } = useSidebar();
  const [toggle, setToggle] = useState<Nullable<NavSectionToggle>>(null);

  const label = tNav(item.key);
  const isSectionActive = pathname.startsWith(item.pathPrefix);

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <NavMenuLink
          href={item.children[0].to}
          icon={item.icon}
          isActive={isSectionActive}
          label={label}
        />
      </SidebarMenuItem>
    );
  }

  const isOpen = toggle?.pathname === pathname ? toggle.isOpen : isSectionActive;
  const Icon = item.icon;

  return (
    <Collapsible
      asChild
      onOpenChange={(open) => setToggle({ isOpen: open, pathname })}
      open={isOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={cn("group", NAV_STYLES.item, NAV_STYLES.idleItem)}>
            <Icon
              className={cn(
                NAV_STYLES.icon,
                isSectionActive ? NAV_STYLES.activeIcon : NAV_STYLES.idleIcon,
              )}
            />
            <span className={NAV_STYLES.label}>{label}</span>
            <ChevronDown className={NAV_STYLES.chevron} />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub aria-label={t(item.listLabelKey)} className="mt-1">
            {item.children.map(({ icon: ChildIcon, labelKey, to }) => {
              const isChildActive = pathname === to;

              return (
                <SidebarMenuSubItem key={to}>
                  <Link
                    aria-current={isChildActive ? "page" : undefined}
                    className={cn(
                      NAV_STYLES.subChild,
                      isChildActive ? NAV_STYLES.subActiveChild : NAV_STYLES.subIdleChild,
                    )}
                    href={to}
                  >
                    {ChildIcon !== null && <ChildIcon className={NAV_STYLES.subIcon} />}
                    <span className={NAV_STYLES.subLabel}>{t(labelKey)}</span>
                  </Link>
                  {isChildActive && (
                    <motion.div
                      className={NAV_STYLES.subIndicator}
                      layoutId="sidebar-active-sub-indicator"
                      transition={ACTIVE_INDICATOR_TRANSITION}
                    />
                  )}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
