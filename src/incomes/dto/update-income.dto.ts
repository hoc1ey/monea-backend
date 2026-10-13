import { PartialType } from '@nestjs/swagger';
import { CreateIncomeDto } from './create-income.dto.js';

export class UpdateIncomeDto extends PartialType(CreateIncomeDto) {}
