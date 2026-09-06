import { SaveBookBudgetsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SaveBookBudgetsInputDto extends createZodDto(SaveBookBudgetsInputSchema) {}
