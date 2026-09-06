import type { ReadingStatisticsGoalSection } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { toIsoDate } from "../../../core/iso-date.js";
import { ReadingGoalPlansService } from "../../reading-goals/index.js";

@Injectable()
export class StatisticsGoalComposer {
  constructor(private readonly readingGoalPlansService: ReadingGoalPlansService) {}

  async compose(userId: string): Promise<ReadingStatisticsGoalSection> {
    const activeGoals = await this.readingGoalPlansService.listActiveGoals(userId);
    const [primary] = activeGoals;

    return {
      activeGoalsCount: activeGoals.length,
      primaryGoal:
        primary === undefined
          ? null
          : {
              contextActions: [{ goalId: primary.goalId, kind: "open_goal" }],
              deadline: toIsoDate(primary.deadline),
              goalId: primary.goalId,
              listName: primary.listName,
              metrics: primary.metrics,
              name: primary.name,
              status: primary.status,
              targetCount: primary.targetCount,
            },
    };
  }
}
