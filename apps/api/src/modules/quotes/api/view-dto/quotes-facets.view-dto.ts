import { QuotesFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuotesFacetsViewDto extends createZodDto(QuotesFacetsViewSchema) {}
