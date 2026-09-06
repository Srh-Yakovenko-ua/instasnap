import { ReadingStatisticsOverviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsOverviewDto extends createZodDto(ReadingStatisticsOverviewSchema) {}
