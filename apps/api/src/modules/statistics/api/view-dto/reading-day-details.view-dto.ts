import { ReadingDayDetailsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingDayDetailsDto extends createZodDto(ReadingDayDetailsSchema) {}
