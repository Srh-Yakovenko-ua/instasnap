import { CreateLoansBatchResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateLoansBatchResultDto extends createZodDto(CreateLoansBatchResultSchema) {}
