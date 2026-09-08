import { QuotesFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuotesFacetsQueryDto extends createZodDto(QuotesFacetsQuerySchema) {}
