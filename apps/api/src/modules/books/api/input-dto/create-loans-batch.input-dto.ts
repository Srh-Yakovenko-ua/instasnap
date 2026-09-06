import { CreateLoansBatchInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateLoansBatchInputDto extends createZodDto(CreateLoansBatchInputSchema) {}
