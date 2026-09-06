import { ReadingStatisticsOverviewQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsOverviewQueryDto extends createZodDto(
  ReadingStatisticsOverviewQuerySchema,
) {}
