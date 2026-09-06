"use client";

import type { LoanHistoryOverviewView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";

type LoanHistorySidebarProps = {
  isLoading: boolean;
  onPersonOpen: (contactId: string) => void;
  overview: LoanHistoryOverviewView | undefined;
};

export function LoanHistoryOverviewPanel(props: LoanHistorySidebarProps) {
  const t = useTranslations("loans.history.overviewPanel");
  const panel = useMobilePageOverviewPanel();

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <div className="flex flex-col gap-4">
          <LoanHistorySidebarSections
            {...props}
            onPersonOpen={(contactId) => panel.closeThen(() => props.onPersonOpen(contactId))}
          />
        </div>
      </MobilePageOverviewPanel>
    </>
  );
}

export function LoanHistorySidebar(props: LoanHistorySidebarProps) {
  const t = useTranslations("loans.history.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <LoanHistorySidebarSections {...props} />
    </aside>
  );
}

function DurationBlock({
  duration,
  isLoading,
}: {
  duration: LoanHistoryOverviewView["duration"] | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("loans.history.sidebar.duration");

  const metrics = [
    { days: duration?.averageDays ?? null, key: "average" },
    { days: duration?.longestDays ?? null, key: "longest" },
    { days: duration?.shortestDays ?? null, key: "shortest" },
  ] as const;

  const rows = metrics.flatMap(({ days, key }) => (days === null ? [] : [{ days, key }]));

  return (
    <SidebarBlock title={t("title")}>
      {isLoading ? (
        <RowSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <MetricRow key={row.key} label={t(row.key)} value={t("days", { count: row.days })} />
          ))}
        </dl>
      )}
    </SidebarBlock>
  );
}

function LoanHistorySidebarSections({
  isLoading,
  onPersonOpen,
  overview,
}: LoanHistorySidebarProps) {
  return (
    <>
      <PeopleBlock
        isLoading={isLoading}
        onPersonOpen={onPersonOpen}
        people={overview?.topPeople ?? []}
      />
      <DurationBlock duration={overview?.duration} isLoading={isLoading} />
      <ReliabilityBlock isLoading={isLoading} reliability={overview?.reliability} />
    </>
  );
}

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-sm text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function PeopleBlock({
  isLoading,
  onPersonOpen,
  people,
}: {
  isLoading: boolean;
  onPersonOpen: (contactId: string) => void;
  people: LoanHistoryOverviewView["topPeople"];
}) {
  const t = useTranslations("loans.history.sidebar.people");
  const tContact = useTranslations("loans.contactDrawer");

  return (
    <SidebarBlock title={t("title")}>
      {isLoading ? <RowSkeleton rows={3} /> : null}

      {!isLoading && people.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : null}

      {!isLoading && people.length > 0 ? (
        <ul className="-mx-1.5 flex flex-col gap-0.5">
          {people.map((person) => (
            <li key={person.contactId}>
              <TooltipHint label={tContact("openPersonCard")}>
                <button
                  aria-label={tContact("openContact", { name: person.personName })}
                  className="group/contact flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => onPersonOpen(person.contactId)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink transition-colors group-hover/contact:text-primary">
                        {person.personName}
                      </span>
                      <UiIcon
                        className="shrink-0 text-muted-foreground transition-colors group-hover/contact:text-primary"
                        name="chevron-right"
                        size={12}
                      />
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t("count", { count: person.totalCount })}
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("breakdown", { borrowed: person.borrowedCount, lent: person.lentCount })}
                  </span>
                </button>
              </TooltipHint>
            </li>
          ))}
        </ul>
      ) : null}
    </SidebarBlock>
  );
}

function ReliabilityBlock({
  isLoading,
  reliability,
}: {
  isLoading: boolean;
  reliability: LoanHistoryOverviewView["reliability"] | undefined;
}) {
  const t = useTranslations("loans.history.sidebar.reliability");

  const total =
    reliability === undefined
      ? 0
      : reliability.onTimeCount + reliability.lateCount + reliability.noDueDateCount;

  return (
    <SidebarBlock title={t("title")}>
      {isLoading ? (
        <RowSkeleton rows={2} />
      ) : reliability === undefined || total === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <p className="font-heading text-sm font-semibold text-ink">
            {reliability.onTimePercent === null
              ? t("noDueDateOnly")
              : t("onTimePercent", { percent: reliability.onTimePercent })}
          </p>
          {reliability.onTimePercent === null ? null : (
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("breakdown", { late: reliability.lateCount, onTime: reliability.onTimeCount })}
            </p>
          )}
          {reliability.noDueDateCount === 0 ? null : (
            <div className="flex flex-col gap-0.5 border-t border-border pt-2.5">
              <p className="text-sm text-muted-foreground tabular-nums">
                {t("noDueDate", { count: reliability.noDueDateCount })}
              </p>
              <p className="text-xs text-muted-foreground">{t("noDueDateNote")}</p>
            </div>
          )}
        </>
      )}
    </SidebarBlock>
  );
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center justify-between gap-2" key={index}>
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
