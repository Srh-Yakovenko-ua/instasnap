"use client";

import type { ReadingStatisticsGoalSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { formatDateShort } from "@/lib/format";

import { toContextActionLinks } from "../../model/statistics-drilldown";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

export function ReadingGoalCard({ goal }: { goal: ReadingStatisticsGoalSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.goal");
  const tStatus = useTranslations("goals.status");
  const primary = goal.primaryGoal;

  if (primary === null) {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/goals">
                <UiIcon name="plus" size={16} />
                {t("create")}
              </Link>
            </Button>
          }
          description={t("emptyDescription")}
          kind="empty"
          title={t("empty")}
        />
      </StatisticsSection>
    );
  }

  const percent = Math.round(primary.metrics.progressPercent);
  const links = toContextActionLinks(primary.contextActions);

  return (
    <StatisticsSection
      description={t("deadline", { date: formatDateShort(primary.deadline, locale) })}
      title={t("title")}
    >
      <div className="flex flex-col gap-2">
        <span className="font-heading text-sm font-medium text-ink">
          {primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount })}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("progress", {
            completed: primary.metrics.completedCount,
            target: primary.targetCount,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Progress
            aria-label={t("progressLabel", { percent })}
            className="h-2 flex-1"
            value={percent}
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{percent}%</span>
        </div>
      </div>

      <dl className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("status")}</dt>
          <dd className="font-medium text-foreground">{tStatus(primary.status)}</dd>
        </div>
        {primary.metrics.pace === null ? null : (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t("pace")}</dt>
            <dd className="font-medium text-foreground">{t(`paces.${primary.metrics.pace}`)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("remaining")}</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {t("remainingValue", { count: primary.metrics.remainingCount })}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("forecast")}</dt>
          <dd className="font-medium text-foreground">
            {primary.metrics.projectedCompletionDate === null ||
            primary.metrics.projectionConfidence === "none" ||
            primary.metrics.projectionConfidence === "low"
              ? t("forecastUnavailable")
              : formatDateShort(primary.metrics.projectedCompletionDate, locale)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <Button asChild key={link.kind} size="sm" variant="secondary">
            <Link href={link.href}>{t("open")}</Link>
          </Button>
        ))}
        {goal.activeGoalsCount <= 1 ? null : (
          <Link className="text-xs text-primary hover:underline" href="/goals">
            {t("otherGoals", { count: goal.activeGoalsCount - 1 })}
          </Link>
        )}
      </div>
    </StatisticsSection>
  );
}
