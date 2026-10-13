import { PartialType } from '@nestjs/swagger';
import { CreateCreditCardDto } from './create-credit-card.dto.js';

export class UpdateCreditCardDto extends PartialType(CreateCreditCardDto) {}
