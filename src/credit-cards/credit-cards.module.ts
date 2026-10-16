import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditCard } from './entities/credit-card.entity.js';
import { CreditCardsService } from './credit-cards.service.js';
import { CreditCardsController } from './credit-cards.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([CreditCard])],
  controllers: [CreditCardsController],
  providers: [CreditCardsService],
  exports: [CreditCardsService, TypeOrmModule],
})
export class CreditCardsModule {}
