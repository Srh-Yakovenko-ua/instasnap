import { StopBookBudgetInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class StopBookBudgetInputDto extends createZodDto(StopBookBudgetInputSchema) {}
